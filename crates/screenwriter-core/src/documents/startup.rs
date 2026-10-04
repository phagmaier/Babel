//! Read-only startup recovery contracts. No path, writer lease, adoption or saved receipt.
use super::{
    DocumentError, DocumentRequest, OpenDocument, SourceEncoding, recovery::CheckpointMetadata,
};
use serde::{Deserialize, Serialize};

pub const MAX_REVIEW_DOCUMENTS: usize = 64;
pub const MAX_DIRECTORY_ENTRIES: usize = 4096;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SelectedRecoveryRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumedDraft {
    pub document: OpenDocument,
    pub draft_metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecoveryOrigin {
    Current,
    Previous,
    Pending,
    PreviousPending,
}
impl RecoveryOrigin {
    pub(super) fn suffix(&self) -> &'static str {
        match self {
            Self::Current => "journal",
            Self::Previous => "previous",
            Self::Pending => "pending",
            Self::PreviousPending => "previous-pending",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecoverySelection {
    pub document_id: String,
    pub origin: RecoveryOrigin,
    /// Full canonical checkpoint hash binds metadata as well as raw source bytes.
    pub record_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCandidate {
    pub selection: RecoverySelection,
    pub session_id: String,
    pub version: u64,
    pub generation: u64,
    pub source_sha256: String,
    pub byte_length: usize,
    pub encoding: SourceEncoding,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecoveryNotice {
    TruncatedTail,
    CorruptTail,
    UnsupportedSchema,
    TooLarge,
    Pending,
    Quarantined,
    ConflictingGeneration,
    UnreadableArtifact,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    pub document_id: String,
    /// No unresolved older-session journal gate; grants no source-save credit.
    #[serde(default)]
    pub reconciled: bool,
    pub candidates: Vec<RecoveryCandidate>,
    pub notices: Vec<RecoveryNotice>,
    pub error: Option<DocumentError>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCatalog {
    pub entries: Vec<RecoveryEntry>,
    pub truncated: bool,
    pub unrecognized_artifacts: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryPreview {
    pub candidate: RecoveryCandidate,
    pub metadata: CheckpointMetadata,
    pub source: Vec<u8>,
}
