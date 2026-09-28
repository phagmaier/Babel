use screenwriter_core::AppInfo;
#[cfg(target_os = "linux")]
use screenwriter_core::documents::DocumentService;
use screenwriter_core::documents::{DocumentError, DocumentRequest, ErrorCode, OpenDocument};
use std::sync::Mutex;

#[derive(Default)]
struct DocumentHost {
    // Initialized only by a future native picker/controller, never an IPC path.
    #[cfg(target_os = "linux")]
    service: Mutex<Option<DocumentService>>,
    #[cfg(not(target_os = "linux"))]
    service: Mutex<()>,
}

impl DocumentHost {
    fn read(&self, request: &DocumentRequest) -> Result<OpenDocument, DocumentError> {
        let service = self
            .service
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        #[cfg(target_os = "linux")]
        return service
            .as_ref()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .read_initial(request);
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (service, request);
            Err(DocumentError::new(ErrorCode::NativeUnavailable))
        }
    }

    fn release(&self, request: &DocumentRequest) -> Result<(), DocumentError> {
        let mut service = self
            .service
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        #[cfg(target_os = "linux")]
        return service
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .release(request);
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (service, request);
            Err(DocumentError::new(ErrorCode::NativeUnavailable))
        }
    }
}

#[tauri::command]
fn read_open_document(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<OpenDocument, DocumentError> {
    state.read(&request)
}

#[tauri::command]
fn release_open_document(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<(), DocumentError> {
    state.release(&request)
}

#[tauri::command]
fn app_info() -> AppInfo {
    screenwriter_core::app_info()
}

#[cfg(feature = "native-editor-proof")]
#[tauri::command]
fn record_native_editor_proof(report: String) -> Result<(), &'static str> {
    if report.len() > 16_384 {
        return Err("proof report exceeds limit");
    }
    eprintln!("M1_NATIVE_EDITOR_PROOF {report}");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(DocumentHost::default());
    #[cfg(feature = "native-editor-proof")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        release_open_document,
        record_native_editor_proof
    ]);
    #[cfg(not(feature = "native-editor-proof"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        release_open_document
    ]);
    builder
        .run(tauri::generate_context!())
        .expect("error while running babel desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_exposes_core_build_information() {
        assert_eq!(app_info(), screenwriter_core::app_info());
    }

    #[cfg(feature = "native-editor-proof")]
    #[test]
    fn native_proof_report_has_a_size_limit() {
        assert_eq!(
            record_native_editor_proof("x".repeat(16_385)),
            Err("proof report exceeds limit")
        );
    }
}

#[cfg(all(test, target_os = "linux"))]
mod document_ipc_tests;
