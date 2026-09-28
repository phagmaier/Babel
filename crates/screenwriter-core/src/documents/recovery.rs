//! Version-1 portable framing. A bad tail never invalidates preceding records.
use super::{DiskFingerprint, DocumentError, DocumentRequest, ErrorCode, MAX_SOURCE_BYTES};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub const MAX_DRAFT_METADATA_BYTES: usize = 64 * 1024;
pub const MAX_VERSION: u64 = (1 << 53) - 1;
pub const HEADER_BYTES: usize = 24;
pub const CHECKSUM_BYTES: usize = 32;
pub const MAX_FRAME_BYTES: usize =
    HEADER_BYTES + CHECKSUM_BYTES + MAX_DRAFT_METADATA_BYTES + MAX_SOURCE_BYTES;
pub const MAX_JOURNAL_BYTES: usize = 2 * MAX_FRAME_BYTES;
const MAGIC: &[u8; 8] = b"BBLREC01";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CheckpointMetadata {
    pub document_id: String,
    pub session_id: String,
    pub version: u64,
    pub generation: u64,
    pub source_sha256: String,
    pub base_fingerprint: Option<DiskFingerprint>,
    pub draft_metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Checkpoint {
    pub metadata: CheckpointMetadata,
    pub source: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TailStatus {
    Clean,
    Truncated,
    Corrupt,
    UnsupportedSchema,
    TooLarge,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalRead {
    pub checkpoints: Vec<Checkpoint>,
    pub tail: TailStatus,
    pub valid_bytes: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointReceipt {
    pub identity: DocumentRequest,
    pub version: u64,
    pub source_sha256: String,
    pub generation: u64,
    /// Discriminator prevents confusing this with a source-file save receipt.
    pub protection: CheckpointProtection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckpointProtection {
    RecoveryCheckpoint,
}

pub fn source_hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn valid_uuid(id: &str) -> bool {
    Uuid::parse_str(id).is_ok_and(|uuid| !uuid.is_nil() && uuid.to_string() == id)
}

impl Checkpoint {
    pub fn capture(
        identity: &DocumentRequest,
        version: u64,
        generation: u64,
        source: &[u8],
        draft_metadata: serde_json::Value,
    ) -> Result<Self, DocumentError> {
        if source.len() > MAX_SOURCE_BYTES {
            return Err(DocumentError::new(ErrorCode::InvalidCheckpoint));
        }
        let value = Self {
            metadata: CheckpointMetadata {
                document_id: identity.document_id.clone(),
                session_id: identity.session_id.clone(),
                version,
                generation,
                source_sha256: source_hash(source),
                base_fingerprint: None,
                draft_metadata,
            },
            source: source.to_vec(),
        };
        value.validate()?;
        Ok(value)
    }

    fn validate(&self) -> Result<(), DocumentError> {
        let m = &self.metadata;
        if !valid_uuid(&m.document_id)
            || !valid_uuid(&m.session_id)
            || m.version == 0
            || m.version > MAX_VERSION
            || m.generation == 0
            || m.generation > MAX_VERSION
            || self.source.len() > MAX_SOURCE_BYTES
            || m.source_sha256 != source_hash(&self.source)
        {
            return Err(DocumentError::new(ErrorCode::InvalidCheckpoint));
        }
        Ok(())
    }

    pub fn encode(&self) -> Result<Vec<u8>, DocumentError> {
        self.validate()?;
        let metadata = serde_json::to_vec(&self.metadata)
            .map_err(|_| DocumentError::new(ErrorCode::InvalidCheckpoint))?;
        if metadata.len() > MAX_DRAFT_METADATA_BYTES {
            return Err(DocumentError::new(ErrorCode::InvalidCheckpoint));
        }
        let mut bytes =
            Vec::with_capacity(HEADER_BYTES + metadata.len() + self.source.len() + CHECKSUM_BYTES);
        bytes.extend_from_slice(MAGIC);
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&(metadata.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(self.source.len() as u64).to_le_bytes());
        bytes.extend_from_slice(&metadata);
        bytes.extend_from_slice(&self.source);
        let digest = Sha256::digest(&bytes);
        bytes.extend_from_slice(&digest);
        Ok(bytes)
    }
}

/// Bounded prefix parser. No resynchronization guesses through corrupt/unknown data.
pub fn decode_journal(bytes: &[u8]) -> JournalRead {
    let mut read = JournalRead {
        checkpoints: Vec::new(),
        tail: TailStatus::Clean,
        valid_bytes: 0,
    };
    while read.valid_bytes < bytes.len() {
        let offset = read.valid_bytes;
        let remaining = &bytes[offset..];
        let (checkpoint, length) = match decode_frame(remaining) {
            Ok(value) => value,
            Err(tail) => {
                read.tail = tail;
                break;
            }
        };
        if read.checkpoints.len() >= 2 || offset + length > MAX_JOURNAL_BYTES {
            read.tail = TailStatus::TooLarge;
            break;
        }
        if let Some(previous) = read.checkpoints.last()
            && (checkpoint.metadata.document_id != previous.metadata.document_id
                || checkpoint.metadata.generation != previous.metadata.generation + 1
                || (checkpoint.metadata.session_id == previous.metadata.session_id
                    && checkpoint.metadata.version <= previous.metadata.version))
        {
            read.tail = TailStatus::Corrupt;
            break;
        }
        read.valid_bytes += length;
        read.checkpoints.push(checkpoint);
    }
    if bytes.len() > MAX_JOURNAL_BYTES {
        read.tail = TailStatus::TooLarge;
    }
    read
}

fn decode_frame(bytes: &[u8]) -> Result<(Checkpoint, usize), TailStatus> {
    if bytes.len() < HEADER_BYTES {
        return Err(TailStatus::Truncated);
    }
    if &bytes[..8] != MAGIC {
        return Err(TailStatus::Corrupt);
    }
    let schema = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    if schema != 1 {
        return Err(TailStatus::UnsupportedSchema);
    }
    let metadata_len = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
    let source_len = u64::from_le_bytes(bytes[16..24].try_into().unwrap());
    if metadata_len > MAX_DRAFT_METADATA_BYTES || source_len > MAX_SOURCE_BYTES as u64 {
        return Err(TailStatus::TooLarge);
    }
    let body_len = HEADER_BYTES + metadata_len + source_len as usize;
    let frame_len = body_len + CHECKSUM_BYTES;
    if bytes.len() < frame_len {
        return Err(TailStatus::Truncated);
    }
    if Sha256::digest(&bytes[..body_len]).as_slice() != &bytes[body_len..frame_len] {
        return Err(TailStatus::Corrupt);
    }
    let metadata: CheckpointMetadata =
        serde_json::from_slice(&bytes[HEADER_BYTES..HEADER_BYTES + metadata_len])
            .map_err(|_| TailStatus::Corrupt)?;
    let checkpoint = Checkpoint {
        metadata,
        source: bytes[HEADER_BYTES + metadata_len..body_len].to_vec(),
    };
    checkpoint.validate().map_err(|_| TailStatus::Corrupt)?;
    Ok((checkpoint, frame_len))
}

#[cfg(test)]
#[path = "recovery_format_tests.rs"]
mod tests;
