//! Explicit recovery-choice envelopes. Requests are path-free; the source is the
//! natively opened registration anchor, never a frontend-supplied path. No choice
//! deletes recovery or source material; retention/pruning belongs to M2-05C.
use super::{
    DiskFingerprint, DocumentRequest, SourceEncoding,
    saving::{SaveObservation, SaveReceipt},
    startup::{RecoveryCandidate, RecoverySelection},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompareRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecoverRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
    pub new_version: u64,
    pub expected_fingerprint: DiskFingerprint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct KeepRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
    pub expected_fingerprint: DiskFingerprint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CopyRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
    pub expected_fingerprint: DiskFingerprint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResolveRequest {
    #[serde(deserialize_with = "super::persistence::native_identity")]
    pub identity: DocumentRequest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChoiceSourceStatus {
    Current,
    Missing,
    Unreadable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChoiceTransaction {
    NoTransaction,
    Prepared,
    InstalledCandidateUnconfirmed,
    ConfirmedRecordMatchesSource,
    Diverged,
    NeedsAttention,
}

impl From<SaveObservation> for ChoiceTransaction {
    fn from(value: SaveObservation) -> Self {
        match value {
            SaveObservation::NoTransaction => Self::NoTransaction,
            SaveObservation::Prepared => Self::Prepared,
            SaveObservation::InstalledCandidateUnconfirmed => Self::InstalledCandidateUnconfirmed,
            SaveObservation::ConfirmedRecordMatchesSource => Self::ConfirmedRecordMatchesSource,
            SaveObservation::Diverged => Self::Diverged,
            SaveObservation::NeedsAttention => Self::NeedsAttention,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChoiceSourceSnapshot {
    pub status: ChoiceSourceStatus,
    pub fingerprint: Option<DiskFingerprint>,
    pub source_sha256: Option<String>,
    pub byte_length: Option<u64>,
    pub encoding: Option<SourceEncoding>,
}

/// Facts about both generations. Timestamps never appear, so no caller can pick
/// a winner by clock. Identical content is still reported per generation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryComparison {
    pub identity: DocumentRequest,
    pub selection: RecoverySelection,
    pub recovery: RecoveryCandidate,
    pub source: ChoiceSourceSnapshot,
    pub identical: bool,
    pub external_divergence: bool,
    pub transaction: ChoiceTransaction,
}

/// Sibling-file emergency copy. Only the file name (never a path) crosses IPC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyReceipt {
    pub identity: DocumentRequest,
    pub version: u64,
    pub file_name: String,
    pub fingerprint: DiskFingerprint,
    pub source_sha256: String,
    pub byte_length: u64,
}

/// Finalize never deletes to resolve; anything outside the two safe
/// post-replacement states returns the observation with no receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionResolution {
    pub identity: DocumentRequest,
    pub observation: ChoiceTransaction,
    pub completed: Option<SaveReceipt>,
    pub previous_preserved: bool,
}
