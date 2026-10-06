//! M3-11 Save As workers. The native file-save picker runs on a blocking
//! worker; IPC carries only strict identity/token envelopes, never a path.
//! Cancellation returns `Ok(None)` and preserves every registration. A
//! successful Save As mints a fresh loose registration beside the untouched
//! source; adopting the new identity stays the caller's explicit M3-12 step.
use super::*;
use screenwriter_core::documents::{
    MAX_SOURCE_BYTES,
    persistence::payload_cost,
    save_as::{SaveAsReceipt, SaveAsRequest, SaveTarget},
};
use std::path::PathBuf;

impl DocumentHost {
    async fn pick_save_target(
        &self,
        request: DocumentRequest,
    ) -> Result<Option<SaveTarget>, DocumentError> {
        let permit = self.reserve(0)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            #[cfg(target_os = "linux")]
            {
                // Fail stale sessions before showing a native save dialog.
                worker
                    .lock()
                    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .as_ref()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .read_initial(&request)?;
                let picked = pick_save_file();
                let path = match picked {
                    None => return Ok(None),
                    Some(path) => path,
                };
                worker
                    .lock()
                    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .as_mut()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .select_save_destination(&request, &path)
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

    async fn publish_save_as(
        &self,
        request: SaveAsRequest,
    ) -> Result<SaveAsReceipt, DocumentError> {
        let c = &request.checkpoint;
        payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
        #[cfg(target_os = "linux")]
        return self
            .document_worker(MAX_SOURCE_BYTES, move |s| s.save_as_copy(&request))
            .await;
        #[cfg(not(target_os = "linux"))]
        {
            let _ = request;
            self.document_worker(MAX_SOURCE_BYTES, ()).await
        }
    }
}

/// Headless tests never display an OS dialog; cancellation preserves state.
#[cfg(test)]
fn pick_save_file() -> Option<PathBuf> {
    None
}

/// Native save dialog runs on the calling blocking worker, never the UI thread.
#[cfg(not(test))]
fn pick_save_file() -> Option<PathBuf> {
    file_dialog()
        .add_filter("Fountain screenplay", &["fountain"])
        .set_file_name("Untitled.fountain")
        .set_title("Save screenplay as")
        .save_file()
}

#[tauri::command]
pub(super) async fn select_save_destination(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<SaveTarget>, DocumentError> {
    state.pick_save_target(request).await
}

#[tauri::command]
pub(super) async fn save_as_copy(
    request: SaveAsRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SaveAsReceipt, DocumentError> {
    state.publish_save_as(request).await
}
