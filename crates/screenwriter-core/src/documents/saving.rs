//! Native immutable queue contract. Enqueueing is never persistence evidence.
use super::{DiskFingerprint, DocumentError, DocumentRequest, recovery::CheckpointReceipt};
use serde::{Deserialize, Serialize};

pub const MAX_QUEUED_SAVES: usize = 8;
pub const MAX_QUEUED_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub version: u64,
    #[serde(deserialize_with = "super::persistence::source_bytes")]
    pub source: Vec<u8>,
    pub source_sha256: String,
    pub expected_fingerprint: DiskFingerprint,
    pub draft_metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SaveProtection {
    SourceFile,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReceipt {
    pub identity: DocumentRequest,
    pub version: u64,
    pub source_sha256: String,
    pub fingerprint: DiskFingerprint,
    pub recovery: CheckpointReceipt,
    pub protection: SaveProtection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReplacementState {
    SourceUnchanged,
    ReplacedButUnconfirmed,
    /// A transport/worker failed without an exact native completion result.
    OutcomeUnknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFailure {
    pub identity: DocumentRequest,
    pub version: u64,
    pub error: DocumentError,
    pub replacement: ReplacementState,
    /// Only present when this call obtained a verified recovery receipt.
    pub recovery: Option<CheckpointReceipt>,
}

impl std::fmt::Display for SaveFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.replacement, self.error)
    }
}

impl std::error::Error for SaveFailure {}

/// Observations after restart, never proof that an acknowledgement was delivered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaveObservation {
    NoTransaction,
    Prepared,
    InstalledCandidateUnconfirmed,
    ConfirmedRecordMatchesSource,
    Diverged,
    NeedsAttention,
}
