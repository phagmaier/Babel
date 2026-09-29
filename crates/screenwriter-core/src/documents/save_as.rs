//! Save As publication versus Export Fountain copy.
//!
//! An export writes a standalone copy and leaves the active document and
//! identity unchanged. Save As publishes the current bytes to a natively
//! selected file and mints a fresh loose identity for the new file; the prior
//! registration is never mutated. A duplicate never inherits remote linkage:
//! loose identity records carry only a schema version and a random document
//! ID. Managed-project adoption is refused: Save As targets resolve to fresh
//! loose registrations only.
use super::{OpenDocument, persistence::CheckpointRequest, snapshots::StorageRelation};
use serde::{Deserialize, Serialize};

/// Native file-save picker result: an opaque token bound to one source
/// registration. File-save tokens never authorize external copies and
/// folder-copy tokens never authorize Save As.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTarget {
    pub token: String,
    pub file_name: String,
    pub storage_relation: StorageRelation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveAsRequest {
    pub checkpoint: CheckpointRequest,
    pub destination_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAsReceipt {
    pub document: OpenDocument,
    pub version: u64,
    pub source_sha256: String,
    pub file_name: String,
    pub storage_relation: StorageRelation,
}
