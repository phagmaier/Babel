//! Path-free recent capabilities; bounded native workers share the writer host.
use super::*;
use document_entry_host::{EntryRequest, pick_source_file};
use screenwriter_core::documents::recents::*;

#[tauri::command]
pub(super) async fn list_recent_projects(
    request: EntryRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<RecentList, DocumentError> {
    let _ = request;
    state
        .document_worker(MAX_RECENT_BYTES * 2, |s| s.list_recent_projects())
        .await
}

#[tauri::command]
pub(super) async fn remove_recent_project(
    request: RecentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<(), DocumentError> {
    state
        .document_worker(MAX_RECENT_BYTES * 2, move |s| {
            s.remove_recent_project(&request)
        })
        .await
}

#[tauri::command]
pub(super) async fn open_recent_project(
    request: RecentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<RecentOpen, DocumentError> {
    state
        .document_worker(
            MAX_RECENT_BYTES * 2 + screenwriter_core::documents::MAX_SOURCE_BYTES,
            move |s| s.open_recent_project(&request),
        )
        .await
}

#[tauri::command]
pub(super) async fn locate_recent_project(
    request: RecentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<LocateSelection>, DocumentError> {
    // Validate before showing the picker, then revalidate after its return. The
    // service mutex is never held while a human chooses a file.
    let id = request.entry_id.clone();
    state
        .document_worker(MAX_RECENT_BYTES * 2, move |s| {
            if !s
                .list_recent_projects()?
                .entries
                .iter()
                .any(|e| e.entry_id == id)
            {
                return Err(DocumentError::new(ErrorCode::InvalidRecentSelection));
            }
            Ok(())
        })
        .await?;
    let permit = state.reserve(screenwriter_core::documents::MAX_SOURCE_BYTES)?;
    let worker = state.service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let Some(path) = pick_source_file() else {
            return Ok(None);
        };
        worker
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .select_recent_location(&request, &path)
            .map(Some)
    })
    .await
    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
}

#[tauri::command]
pub(super) async fn confirm_recent_location(
    request: ConfirmLocateRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<RecentOpen, DocumentError> {
    state
        .document_worker(
            MAX_RECENT_BYTES * 2 + screenwriter_core::documents::MAX_SOURCE_BYTES,
            move |s| s.confirm_recent_location(&request),
        )
        .await
}
