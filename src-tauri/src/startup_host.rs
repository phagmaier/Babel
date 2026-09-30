//! Read-only startup commands. Native setup supplies the OS app-data path, never the frontend.
use super::{Arc, DocumentHost, Mutex};
#[cfg(target_os = "linux")]
use screenwriter_core::documents::MAX_SOURCE_BYTES;
use screenwriter_core::documents::{
    DocumentError, ErrorCode,
    startup::{CatalogRequest, RecoveryCatalog, RecoveryPreview, RecoverySelection},
};
use screenwriter_core::documents::{
    DocumentRequest,
    startup::{RecoveryEntry, ResumedDraft, SelectedRecoveryRequest},
};
use std::path::PathBuf;

#[tauri::command]
pub(super) async fn list_document_recovery(
    request: DocumentRequest,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryEntry, DocumentError> {
    #[cfg(target_os = "linux")]
    return documents
        .snapshot_worker(move |service| service.list_document_recovery(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (request, documents);
        Err(DocumentError::new(ErrorCode::NativeUnavailable))
    }
}

#[tauri::command]
pub(super) async fn read_document_recovery(
    request: SelectedRecoveryRequest,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryPreview, DocumentError> {
    #[cfg(target_os = "linux")]
    return documents
        .snapshot_worker(move |service| service.read_document_recovery(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (request, documents);
        Err(DocumentError::new(ErrorCode::NativeUnavailable))
    }
}

#[tauri::command]
pub(super) async fn resume_local_recovery(
    request: RecoverySelection,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<ResumedDraft, DocumentError> {
    #[cfg(target_os = "linux")]
    return documents
        .snapshot_worker(move |service| service.resume_local_recovery(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (request, documents);
        Err(DocumentError::new(ErrorCode::NativeUnavailable))
    }
}

#[derive(Clone, Default)]
pub(super) struct RecoveryHost {
    pub(super) root: Arc<Mutex<Option<PathBuf>>>,
}
impl RecoveryHost {
    #[cfg(target_os = "linux")]
    async fn read<T: Send + 'static>(
        &self,
        documents: &DocumentHost,
        read: impl FnOnce(
            Option<&screenwriter_core::documents::LocalRecoveryReader>,
        ) -> Result<T, DocumentError>
        + Send
        + 'static,
    ) -> Result<T, DocumentError> {
        let root = self
            .root
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
            .clone()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?;
        // At most two review workers coexist; bound native payload work, not JSON memory overhead.
        let permit = documents.reserve(MAX_SOURCE_BYTES)?;
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let reader = screenwriter_core::documents::LocalRecoveryReader::open(&root)?;
            read(reader.as_ref())
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }
}

#[tauri::command]
pub(super) async fn list_local_recovery(
    request: CatalogRequest,
    state: tauri::State<'_, RecoveryHost>,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryCatalog, DocumentError> {
    let _ = request;
    #[cfg(target_os = "linux")]
    {
        state
            .read(&documents, |reader| {
                reader.map_or_else(|| Ok(RecoveryCatalog::default()), |r| r.catalog())
            })
            .await
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, documents);
        Err(DocumentError::new(ErrorCode::NativeUnavailable))
    }
}

#[tauri::command]
pub(super) async fn read_local_recovery(
    request: RecoverySelection,
    state: tauri::State<'_, RecoveryHost>,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryPreview, DocumentError> {
    #[cfg(target_os = "linux")]
    {
        state
            .read(&documents, move |reader| {
                reader
                    .ok_or_else(|| DocumentError::new(ErrorCode::RecoveryNeedsAttention))?
                    .preview(&request)
            })
            .await
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (request, state, documents);
        Err(DocumentError::new(ErrorCode::NativeUnavailable))
    }
}
