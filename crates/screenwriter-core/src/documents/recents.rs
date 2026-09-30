//! Auxiliary metadata only. Requests contain native UUID capabilities, never paths.
use super::{DocumentError, DocumentKind, ErrorCode, OpenDocument};
use serde::{Deserialize, Serialize, de};

pub const MAX_RECENTS: usize = 64;
pub const MAX_LOCATE_SELECTIONS: usize = 32;
pub const MAX_RECENT_BYTES: usize = 2 * 1024 * 1024;

fn native_token<'de, D: serde::Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    let value = String::deserialize(d)?;
    if uuid::Uuid::parse_str(&value).is_ok_and(|id| !id.is_nil() && id.to_string() == value) {
        Ok(value)
    } else {
        Err(de::Error::custom("invalid native recent selection"))
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecentRequest {
    #[serde(deserialize_with = "native_token")]
    pub entry_id: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocateChoice {
    LinkMoved,
    OpenDifferent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfirmLocateRequest {
    #[serde(deserialize_with = "native_token")]
    pub entry_id: String,
    #[serde(deserialize_with = "native_token")]
    pub selection_token: String,
    pub choice: LocateChoice,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecentAvailability {
    Available,
    Missing,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecentHealth {
    Ready,
    NeedsAttention,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub entry_id: String,
    pub document_id: String,
    pub kind: DocumentKind,
    /// Bounded filename derivative, not canonical title-page content.
    pub file_name: String,
    pub last_known_modified_seconds: i64,
    pub last_known_modified_nanos: i64,
    pub availability: RecentAvailability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentList {
    pub entries: Vec<RecentEntry>,
    pub health: RecentHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocateSelection {
    pub entry_id: String,
    pub selection_token: String,
    pub file_name: String,
    pub same_managed_identity: bool,
    /// Comparison only. Equal bytes do not establish identity.
    pub content_matches_last_known: bool,
    pub can_link_moved: bool,
}

// Keep successful source operations independent of auxiliary publication failure.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentOpen {
    pub document: OpenDocument,
    pub registry_health: RecentHealth,
}

pub(crate) fn attention() -> DocumentError {
    DocumentError::new(ErrorCode::RecentNeedsAttention)
}
