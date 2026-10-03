//! Handle-only external source observation and explicit protected adoption.
use super::{DiskFingerprint, DocumentRequest, persistence::CheckpointRequest};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceCheckRequest {
    pub identity: DocumentRequest,
    pub expected_fingerprint: DiskFingerprint,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceCheckStatus {
    Unchanged,
    MetadataOnly,
    Changed,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCheck {
    pub identity: DocumentRequest,
    pub status: SourceCheckStatus,
    pub fingerprint: DiskFingerprint,
    /// Only a divergent generation needs a full comparison buffer.
    pub source: Option<Vec<u8>>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReloadRequest {
    pub current: CheckpointRequest,
    pub adopted: CheckpointRequest,
}
