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
