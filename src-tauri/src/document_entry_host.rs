//! M3-09 native document entry. No IPC argument carries a filesystem path.
//!
//! The OS file/folder picker runs natively on a blocking worker; the frontend
//! only learns the resulting registration or opaque destination token.
//! Cancelling a picker returns `Ok(None)` and preserves every registration,
//! journal and destination token. Unknown-schema, missing, read-only,
//! contended and invalid-encoding sources keep the conservative M2-01
//! outcomes through `open_selected`.
use super::*;
use screenwriter_core::documents::{MAX_SOURCE_BYTES, snapshots::CopyDestination};
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct EntryRequest {}

impl DocumentHost {
    async fn create_unsaved(&self) -> Result<OpenDocument, DocumentError> {
        #[cfg(target_os = "linux")]
        return self.document_worker(0, move |s| s.register_unsaved()).await;
        #[cfg(not(target_os = "linux"))]
        {
            let _ = ();
            self.document_worker(0, ()).await
        }
    }

    async fn open_picked(&self) -> Result<Option<OpenDocument>, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            // An uninitialized host reports unavailability without a dialog.
            worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
                .as_ref()
                .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?;
            let picked = pick_source_file();
            let path = match picked {
                None => return Ok(None),
                Some(path) => path,
            };
            let mut service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                service
                    .as_mut()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .open_selected(&path)
                    .map(Some)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, path);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    async fn pick_destination(
        &self,
        request: DocumentRequest,
    ) -> Result<Option<CopyDestination>, DocumentError> {
        let permit = self.reserve(0)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            #[cfg(target_os = "linux")]
            {
                // Fail stale sessions before showing a native folder picker.
                worker
                    .lock()
                    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .as_ref()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .read_initial(&request)?;
                let picked = pick_destination_folder();
                let path = match picked {
                    None => return Ok(None),
                    Some(path) => path,
                };
                worker
                    .lock()
                    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .as_mut()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .select_copy_destination(&request, &path)
                    .map(Some)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&worker, request);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }
}

/// Headless tests never display an OS dialog; cancellation preserves state.
#[cfg(test)]
pub(super) fn pick_source_file() -> Option<PathBuf> {
    None
}

/// Native file picker runs on the calling blocking worker, never the UI thread.
#[cfg(not(test))]
pub(super) fn pick_source_file() -> Option<PathBuf> {
    file_dialog()
        .add_filter("Fountain screenplay", &["fountain"])
        .set_title("Open Fountain screenplay")
        .pick_file()
}

/// Headless tests never display an OS dialog; cancellation preserves state.
#[cfg(test)]
fn pick_destination_folder() -> Option<PathBuf> {
    None
}

/// Native folder picker runs on the calling blocking worker, never the UI thread.
#[cfg(not(test))]
fn pick_destination_folder() -> Option<PathBuf> {
    file_dialog()
        .set_title("Choose destination folder")
        .pick_folder()
}

#[tauri::command]
pub(super) async fn create_unsaved_draft(
    request: EntryRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<OpenDocument, DocumentError> {
    let _ = request;
    state.create_unsaved().await
}

#[tauri::command]
pub(super) async fn open_source_via_picker(
    request: EntryRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<OpenDocument>, DocumentError> {
    let _ = request;
    state.open_picked().await
}

#[tauri::command]
pub(super) async fn select_destination(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<CopyDestination>, DocumentError> {
    state.pick_destination(request).await
}
