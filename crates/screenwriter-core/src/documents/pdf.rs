//! Native-only export authorities; tokens cannot be spent by source/copy services.
use super::{DocumentRequest, persistence::CheckpointRequest};
use serde::{Deserialize, Serialize};
pub const MAX_PDF_BYTES: usize = 32 * 1024 * 1024;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PdfCaptureReceipt {
    pub identity: DocumentRequest,
    pub capture_token: String,
    pub version: u64,
    pub source_sha256: String,
    pub checkpoint: super::recovery::CheckpointReceipt,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PdfTarget {
    pub token: String,
    pub file_name: String,
    pub replaces_existing: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PdfPublicationReceipt {
    pub file_name: String,
    pub pdf_sha256: String,
    pub byte_length: usize,
    pub previous_file_name: Option<String>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreparePdfRequest {
    pub checkpoint: CheckpointRequest,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PdfCaptureRequest {
    pub identity: DocumentRequest,
    pub capture_token: String,
}
