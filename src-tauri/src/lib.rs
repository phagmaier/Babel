use screenwriter_core::AppInfo;
#[cfg(target_os = "linux")]
use screenwriter_core::documents::DocumentService;
use screenwriter_core::documents::{DocumentError, DocumentRequest, ErrorCode, OpenDocument};
use std::sync::{Arc, Mutex};
#[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
mod editor_composition_proof;
#[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
use editor_composition_proof::{
    open_composition_fixture, record_composition_proof, select_snapshot_proof_destination,
};
mod document_entry_host;
use document_entry_host::{create_unsaved_draft, open_source_via_picker, select_destination};
mod persistence_host;
mod recovery_choices_host;
mod snapshot_host;
mod startup_host;
use persistence_host::{Budget, checkpoint_document, protect_fountain_import, save_document};
use recovery_choices_host::{
    compare_recovery, keep_current_source, recover_checkpoint_as_current, resolve_save_transaction,
    save_recovered_copy,
};
use snapshot_host::{
    create_snapshot, list_snapshots, prune_snapshots, read_snapshot, restore_snapshot,
    save_external_copy,
};
use startup_host::{RecoveryHost, list_local_recovery, read_local_recovery};
use tauri::{Emitter, Manager};

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
    fn has_open_documents(&self) -> bool {
        #[cfg(target_os = "linux")]
        return self.service.lock().map_or(true, |s| {
            s.as_ref().is_some_and(DocumentService::has_open_documents)
        });
        #[cfg(not(target_os = "linux"))]
        {
            false
        }
    }

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

    fn release_at_risk(&self, request: &DocumentRequest) -> Result<(), DocumentError> {
        let mut service = self
            .service
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        #[cfg(target_os = "linux")]
        return service
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .release_at_risk(request);
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
async fn release_open_document_at_risk(
    request: DocumentRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<(), DocumentError> {
    state.release_at_risk_worker(request).await
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window.state::<DocumentHost>().has_open_documents()
            {
                api.prevent_close();
                if let Err(error) = window.emit("protected-close-requested", ()) {
                    eprintln!("protected close event unavailable: {error}");
                }
            }
        })
        .setup(|app| {
            // Resolve only. Startup review does not initialize/create the writer store or a source.
            let root = app.path().app_data_dir().ok();
            *app.state::<RecoveryHost>()
                .root
                .lock()
                .map_err(|_| std::io::Error::other("recovery host unavailable"))? = root.clone();
            #[cfg(target_os = "linux")]
            {
                // Production writer store lives in private app data only. A
                // failure leaves the host uninitialized; entry commands then
                // report nativeUnavailable instead of inventing a manuscript.
                if let Some(dir) = root
                    && let Ok(service) = DocumentService::new(&dir)
                    && let Ok(mut host) = app.state::<DocumentHost>().service.lock()
                {
                    *host = Some(service);
                }
            }
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
        create_unsaved_draft,
        open_source_via_picker,
        select_destination,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        list_snapshots,
        read_snapshot,
        create_snapshot,
        prune_snapshots,
        restore_snapshot,
        save_external_copy,
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
        create_unsaved_draft,
        open_source_via_picker,
        select_destination,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        list_snapshots,
        read_snapshot,
        create_snapshot,
        prune_snapshots,
        restore_snapshot,
        save_external_copy,
        resolve_save_transaction
    ]);
    #[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        read_open_document,
        create_unsaved_draft,
        open_source_via_picker,
        select_destination,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        save_document,
        compare_recovery,
        recover_checkpoint_as_current,
        keep_current_source,
        save_recovered_copy,
        list_snapshots,
        read_snapshot,
        create_snapshot,
        prune_snapshots,
        restore_snapshot,
        save_external_copy,
        resolve_save_transaction,
        open_composition_fixture,
        select_snapshot_proof_destination,
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
mod document_entry_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod persistence_cadence_tests;

#[cfg(all(test, target_os = "linux"))]
mod document_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod recovery_choices_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod startup_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod snapshot_ipc_tests;
