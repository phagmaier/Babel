//! Snapshot receipts are independent of source/recovery acknowledgements.
use super::{DiskFingerprint, DocumentRequest, persistence::CheckpointRequest};
use serde::{Deserialize, Serialize};

pub const MAX_SNAPSHOT_RECORDS: usize = 256;
pub const MAX_SNAPSHOT_BYTES: u64 = 256 * 1024 * 1024;
pub const ROLLING_INTERVAL_SECONDS: u64 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotKind {
    Rolling,
    Named,
    PreDestructive,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnapshotRequest {
    pub checkpoint: CheckpointRequest,
    pub kind: SnapshotKind,
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnapshotSelection {
    pub snapshot_id: String,
    pub record_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnapshotRecord {
    pub schema_version: u32,
    pub snapshot_id: String,
    pub document_id: String,
    pub session_id: String,
    pub version: Option<u64>,
    pub source_sha256: String,
    pub byte_length: u64,
    /// Native wall clock, used only for retention buckets; never a recovery winner.
    pub created_seconds: u64,
    pub kind: SnapshotKind,
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub selection: SnapshotSelection,
    pub record: SnapshotRecord,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCatalog {
    pub entries: Vec<SnapshotEntry>,
    pub source_bytes: u64,
    pub needs_attention: bool,
    pub unresolved_artifacts: usize,
    pub orphan_blobs: usize,
    pub at_limit: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnapshotReadRequest {
    pub identity: DocumentRequest,
    pub selection: SnapshotSelection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPreview {
    pub entry: SnapshotEntry,
    pub source: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreSnapshotRequest {
    pub current: CheckpointRequest,
    pub selection: SnapshotSelection,
    pub new_version: u64,
    #[serde(default)]
    pub replacement_metadata: Option<serde_json::Value>,
    pub expected_fingerprint: DiskFingerprint,
}

/// Native selection returns an opaque capability bound to this registration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyDestination {
    pub token: String,
    pub storage_relation: StorageRelation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StorageRelation {
    SameFilesystem,
    UnknownPhysicalDisk,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExternalCopyRequest {
    pub checkpoint: CheckpointRequest,
    pub destination_token: String,
    #[serde(default)]
    pub format: CopyFormat,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CopyFormat {
    #[default]
    Fountain,
    DraftBundle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCopyReceipt {
    pub identity: DocumentRequest,
    pub version: u64,
    pub source_sha256: String,
    pub byte_length: u64,
    pub file_name: String,
    pub storage_relation: StorageRelation,
}
