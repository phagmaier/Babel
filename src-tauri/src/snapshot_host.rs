//! Bounded path-free workers. Folder selection remains a native controller operation.
use super::*;
use screenwriter_core::documents::{
    MAX_SOURCE_BYTES,
    persistence::payload_cost,
    saving::{ReplacementState, SaveFailure, SaveReceipt},
    snapshots::*,
};

impl DocumentHost {
    pub(super) async fn snapshot_worker<T: Send + 'static>(
        &self,
        #[cfg(target_os = "linux")] operation: impl FnOnce(
            &mut DocumentService,
        ) -> Result<T, DocumentError>
        + Send
        + 'static,
        #[cfg(not(target_os = "linux"))] operation: impl Send + 'static,
    ) -> Result<T, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                operation(
                    service
                        .as_mut()
                        .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?,
                )
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, operation);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }
}
#[tauri::command]
pub(super) async fn list_snapshots(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SnapshotCatalog, DocumentError> {
    #[cfg(target_os = "linux")]
    return state
        .snapshot_worker(move |s| s.list_snapshots(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.snapshot_worker(()).await
    }
}
#[tauri::command]
pub(super) async fn read_snapshot(
    request: SnapshotReadRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SnapshotPreview, DocumentError> {
    #[cfg(target_os = "linux")]
    return state
        .snapshot_worker(move |s| s.read_snapshot(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.snapshot_worker(()).await
    }
}
#[tauri::command]
pub(super) async fn create_snapshot(
    request: SnapshotRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<SnapshotEntry>, DocumentError> {
    let c = &request.checkpoint;
    payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
    #[cfg(target_os = "linux")]
    return state
        .snapshot_worker(move |s| s.create_snapshot(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.snapshot_worker(()).await
    }
}
#[tauri::command]
pub(super) async fn prune_snapshots(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SnapshotCatalog, DocumentError> {
    #[cfg(target_os = "linux")]
    return state
        .snapshot_worker(move |s| s.prune_snapshots(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.snapshot_worker(()).await
    }
}
#[tauri::command]
pub(super) async fn save_external_copy(
    request: ExternalCopyRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<ExternalCopyReceipt, DocumentError> {
    let c = &request.checkpoint;
    payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
    #[cfg(target_os = "linux")]
    return state
        .snapshot_worker(move |s| s.save_external_copy(&request))
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.snapshot_worker(()).await
    }
}
#[tauri::command]
pub(super) async fn restore_snapshot(
    request: RestoreSnapshotRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SaveReceipt, Box<SaveFailure>> {
    let failure = |error| {
        Box::new(SaveFailure {
            identity: request.current.identity.clone(),
            version: request.new_version,
            error,
            replacement: ReplacementState::SourceUnchanged,
            recovery: None,
        })
    };
    let c = &request.current;
    payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata).map_err(failure)?;
    let permit = state
        .reserve(screenwriter_core::documents::saving::MAX_QUEUED_BYTES)
        .map_err(failure)?;
    let unavailable = failure(DocumentError::new(ErrorCode::NativeUnavailable));
    let mut unknown = unavailable.clone();
    unknown.replacement = ReplacementState::OutcomeUnknown;
    let join_failure = unknown.clone();
    let worker = state.service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let mut service = worker.lock().map_err(|_| unknown.clone())?;
        #[cfg(target_os = "linux")]
        {
            service
                .as_mut()
                .ok_or(unavailable)?
                .restore_snapshot(&request)
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (&mut service, request);
            Err(unavailable)
        }
    })
    .await
    .map_err(|_| join_failure)?
}
