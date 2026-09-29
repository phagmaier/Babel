//! Headless native authority. No parser or path-based IPC. Source writes are native-only.
use serde::{Deserialize, Serialize};

pub mod choices;
pub mod history;
pub mod persistence;
pub mod recovery;
pub mod save_as;
pub mod saving;
pub mod snapshots;
pub mod startup;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::{
    DocumentService, LocalRecoveryReader, RecoveryInspection, SaveInspection,
    ensure_private_app_dir,
};

pub const MAX_SOURCE_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_OPEN_DOCUMENTS: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DocumentRequest {
    pub handle: String,
    pub document_id: String,
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DocumentKind {
    Managed,
    Loose,
    Unsaved,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ViewReason {
    ReadOnly,
    UnsafePermissions,
    UnsupportedEncoding,
    HardLinked,
    ForeignOwner,
    AlreadyOwned,
    IdentityUnavailable,
    UnknownProjectSchema,
    InvalidProjectMetadata,
    SourceMappingMismatch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum Ownership {
    Exclusive,
    ViewOnly { reasons: Vec<ViewReason> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceEncoding {
    Utf8,
    Unsupported,
}

/// String device/inode fields avoid rounding in JavaScript. Hash is native SHA-256.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiskFingerprint {
    pub device: String,
    pub inode: String,
    pub byte_length: u64,
    pub sha256: String,
    pub modified_seconds: i64,
    pub modified_nanos: i64,
    pub changed_seconds: i64,
    pub changed_nanos: i64,
    pub mode: u32,
    pub owner: u32,
    pub links: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocument {
    pub identity: DocumentRequest,
    pub kind: DocumentKind,
    pub persistent_identity: bool,
    pub ownership: Ownership,
    pub encoding: SourceEncoding,
    /// Exact bytes, including BOM, unknown syntax and malformed UTF-8.
    pub source: Vec<u8>,
    pub fingerprint: Option<DiskFingerprint>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    MissingSource,
    PermissionDenied,
    UnsafePath,
    NotRegularFile,
    SourceTooLarge,
    SourceChanged,
    IdentityStoreUnavailable,
    InvalidHandle,
    IdentityMismatch,
    OwnershipRequired,
    OwnershipLost,
    TooManyDocuments,
    NativeUnavailable,
    RecoveryNeedsAttention,
    InvalidCheckpoint,
    StaleRecoveryVersion,
    CheckpointConflict,
    InvalidSave,
    StaleSaveVersion,
    SaveConflict,
    SaveQueueFull,
    SaveNeedsAttention,
    SnapshotNeedsAttention,
    HistoryNeedsAttention,
    SnapshotLimit,
    InvalidSnapshot,
    InvalidDestination,
    Io,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecoveryAction {
    SelectSourceAgain,
    ReopenOrSaveCopy,
    Retry,
}

/// Deliberately excludes OS error text, paths and manuscript content.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentError {
    pub code: ErrorCode,
    pub action: RecoveryAction,
}

impl DocumentError {
    pub fn new(code: ErrorCode) -> Self {
        let action = match code {
            ErrorCode::MissingSource | ErrorCode::UnsafePath | ErrorCode::NotRegularFile => {
                RecoveryAction::SelectSourceAgain
            }
            ErrorCode::SourceChanged
            | ErrorCode::OwnershipLost
            | ErrorCode::OwnershipRequired
            | ErrorCode::RecoveryNeedsAttention
            | ErrorCode::SaveNeedsAttention => RecoveryAction::ReopenOrSaveCopy,
            _ => RecoveryAction::Retry,
        };
        Self { code, action }
    }
}

impl std::fmt::Display for DocumentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.code)
    }
}

impl std::error::Error for DocumentError {}
