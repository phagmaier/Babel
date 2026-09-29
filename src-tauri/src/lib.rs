use screenwriter_core::AppInfo;
#[cfg(target_os = "linux")]
use screenwriter_core::documents::DocumentService;
use screenwriter_core::documents::{DocumentError, DocumentRequest, ErrorCode, OpenDocument};
use std::sync::{Arc, Mutex};
#[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
mod editor_composition_proof;
#[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
use editor_composition_proof::{open_composition_fixture, record_composition_proof};
mod persistence_host;
mod recovery_choices_host;
mod startup_host;
use persistence_host::{Budget, checkpoint_document, save_document};
use recovery_choices_host::{
    compare_recovery, keep_current_source, recover_checkpoint_as_current, resolve_save_transaction,
    save_recovered_copy,
};
use startup_host::{RecoveryHost, list_local_recovery, read_local_recovery};
use tauri::Manager;

#[derive(Clone, Default)]
struct DocumentHost {
    // Production initialization belongs to a future native picker/controller, never an IPC path.
    // Proof builds initialize only their marked synthetic store during setup.
    #[cfg(target_os = "linux")]
    service: Arc<Mutex<Option<DocumentService>>>,
    #[cfg(not(target_os = "linux"))]
    service: Arc<Mutex<()>>,
    budget: Arc<Mutex<Budget>>,
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
async fn read_open_document(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<OpenDocument, DocumentError> {
    state.read_worker(request).await
}

#[tauri::command]
async fn release_open_document(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<(), DocumentError> {
    state.release_worker(request).await
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
    let builder = tauri::Builder::default()
        .manage(DocumentHost::default())
        .manage(RecoveryHost::default())
        .setup(|app| {
            // Resolve only. Startup review does not initialize/create the writer store or a source.
            let root = app.path().app_data_dir().ok();
            *app.state::<RecoveryHost>()
                .root
                .lock()
                .map_err(|_| std::io::Error::other("recovery host unavailable"))? = root;
            #[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
            editor_composition_proof::initialize(app)?;
            Ok(())
        });
    #[cfg(all(
        feature = "native-editor-proof",
        not(all(feature = "editor-composition-proof", target_os = "linux"))
    ))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        release_open_document,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        resolve_save_transaction,
        record_native_editor_proof
    ]);
    #[cfg(not(any(
        feature = "native-editor-proof",
        all(feature = "editor-composition-proof", target_os = "linux")
    )))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        release_open_document,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        resolve_save_transaction
    ]);
    #[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        release_open_document,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        resolve_save_transaction,
        open_composition_fixture,
        record_composition_proof,
        #[cfg(feature = "native-editor-proof")]
        record_native_editor_proof
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

#[cfg(all(test, target_os = "linux"))]
mod recovery_choices_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod startup_ipc_tests;
