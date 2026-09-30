//! Curated local revisions. A history receipt never acknowledges source or recovery durability.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RevisionReceipt {
    pub document_id: String,
    pub version: Option<u64>,
    pub source_sha256: String,
    pub profile_sha256: String,
    pub commit_id: String,
    pub changed: bool,
    pub safety_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HistoryHealth {
    Ready,
    NeedsAttention,
}

/// Both protections refer to the exact pre-import editor bytes. Neither saves the source file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportProtectionReceipt {
    pub checkpoint: super::recovery::CheckpointReceipt,
    pub revision: RevisionReceipt,
}

/// Closed set of app-owned workflows: no caller-supplied history labels or paths.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowOperation {
    FountainImport,
    SceneMove,
    SectionMove,
}

impl WorkflowOperation {
    pub(super) fn label(self) -> &'static str {
        match self {
            Self::FountainImport => "Before Fountain import",
            Self::SceneMove => "Before large scene move",
            Self::SectionMove => "Before large section move",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkflowProtectionRequest {
    pub operation: WorkflowOperation,
    pub checkpoint: super::persistence::CheckpointRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkflowProtectionReceipt {
    pub operation: WorkflowOperation,
    pub byte_length: u64,
    pub checkpoint: super::recovery::CheckpointReceipt,
    pub revision: RevisionReceipt,
}
