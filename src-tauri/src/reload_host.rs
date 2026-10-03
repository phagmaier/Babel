//! Bounded, serialized handle-only checks and explicit Reload; no frontend paths.
use super::*;
use screenwriter_core::documents::{
    persistence::payload_cost,
    reload::{ReloadRequest, SourceCheck, SourceCheckRequest},
    saving::SaveReceipt,
};

#[tauri::command]
pub(super) async fn check_source_document(
    request: SourceCheckRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SourceCheck, DocumentError> {
    let permit = state.reserve(screenwriter_core::documents::MAX_SOURCE_BYTES)?;
    let worker = state.service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let mut service = worker
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        #[cfg(target_os = "linux")]
        return service
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .check_source(&request);
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (&mut service, request);
            Err(DocumentError::new(ErrorCode::NativeUnavailable))
        }
    })
    .await
    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
}

#[tauri::command]
pub(super) async fn reload_source_document(
    request: ReloadRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SaveReceipt, DocumentError> {
    let mut cost = screenwriter_core::documents::MAX_SOURCE_BYTES;
    for capture in [&request.current, &request.adopted] {
        cost += payload_cost(
            capture.version,
            &capture.source,
            &capture.source_sha256,
            &capture.draft_metadata,
        )?;
    }
    let permit = state.reserve(cost)?;
    let worker = state.service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let mut service = worker
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        #[cfg(target_os = "linux")]
        return service
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .reload_source_document(&request);
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (&mut service, request);
            Err(DocumentError::new(ErrorCode::NativeUnavailable))
        }
    })
    .await
    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
}
