mod command_menu;
use command_menu::{CommandMenu, update_command_menu};
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
#[cfg(target_os = "linux")]
mod enchant;
#[cfg(target_os = "linux")]
mod spellcheck_host;
#[cfg(target_os = "linux")]
use spellcheck_host::{SpellcheckHost, spellcheck};
mod document_entry_host;
use document_entry_host::{create_unsaved_draft, open_source_via_picker, select_destination};
#[cfg(target_os = "linux")]
mod recent_projects_host;
#[cfg(target_os = "linux")]
use recent_projects_host::{
    confirm_recent_location, list_recent_projects, locate_recent_project, open_recent_project,
    remove_recent_project,
};
mod save_as_host;
use save_as_host::{save_as_copy, select_save_destination};
mod persistence_host;
mod publication_host;
mod recovery_choices_host;
mod snapshot_host;
use publication_host::{PublicationHost, cancel_publication, render_publication};
mod startup_host;
use persistence_host::{
    Budget, checkpoint_document, protect_fountain_import, protect_workflow, save_document,
};
use recovery_choices_host::{
    compare_recovery, keep_current_source, recover_checkpoint_as_current, resolve_save_transaction,
    save_recovered_copy,
};
use snapshot_host::{
    create_snapshot, list_snapshots, prune_snapshots, read_snapshot, restore_snapshot,
    save_external_copy,
};
use startup_host::{
    RecoveryHost, list_document_recovery, list_local_recovery, read_document_recovery,
    read_local_recovery, resume_local_recovery,
};
use tauri::{Emitter, Manager};

#[derive(Clone, Default)]
struct DocumentHost {
    // Production setup uses OS app data; native pickers supply source anchors, never IPC paths.
    // Proof builds initialize only their marked synthetic store during setup.
    #[cfg(target_os = "linux")]
    service: Arc<Mutex<Option<DocumentService>>>,
    #[cfg(not(target_os = "linux"))]
    service: Arc<Mutex<()>>,
    budget: Arc<Mutex<Budget>>,
    publication: PublicationHost,
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
            .release(request)
            .map(|()| {
                let _ = self.publication.cancel(
                    Some(&publication_host::CancelRequest {
                        identity: request.clone(),
                        request_id: 0,
                    }),
                    true,
                );
            });
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
            .release_at_risk(request)
            .map(|()| {
                let _ = self.publication.cancel(
                    Some(&publication_host::CancelRequest {
                        identity: request.clone(),
                        request_id: 0,
                    }),
                    true,
                );
            });
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

/// WebKitGTK 2.52 can abort while its web process runs exit-time EGL/GBM
/// teardown after the window closes (M4-15; upstream WebKit 305909/315577).
/// This close is unprotected: no document remains open and the web process
/// owns no author state, so end it before the window and app go away instead
/// of letting it run that teardown. Runs synchronously on the main thread.
#[cfg(target_os = "linux")]
fn end_web_content_before_close<R: tauri::Runtime>(window: &tauri::Window<R>) {
    use webkit2gtk::WebViewExt;
    let Some(webview) = window.app_handle().get_webview_window(window.label()) else {
        return;
    };
    if let Err(error) = webview.with_webview(|platform| platform.inner().terminate_web_process()) {
        eprintln!("web content shutdown unavailable: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let documents = DocumentHost::default();
    let publication = documents.publication.clone();
    let builder = tauri::Builder::default()
        .manage(documents)
        .manage(CommandMenu::default())
        .manage(publication)
        .manage(RecoveryHost::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<DocumentHost>().has_open_documents() {
                    api.prevent_close();
                    if let Err(error) = window.emit("protected-close-requested", ()) {
                        eprintln!("protected close event unavailable: {error}");
                    }
                } else {
                    let _ = window.state::<PublicationHost>().cancel(None, true);
                    #[cfg(target_os = "linux")]
                    end_web_content_before_close(window);
                }
            }
        })
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{InputMethodContextExt, WebViewExt};
                // Wry disables client preedit by default. The authoring surface
                // needs real composition events for its edit/navigation guards.
                let window = app
                    .get_webview_window("main")
                    .ok_or_else(|| std::io::Error::other("main WebView unavailable"))?;
                window.with_webview(|webview| {
                    if let Some(context) = webview.inner().input_method_context() {
                        context.set_enable_preedit(true);
                    } else {
                        eprintln!("native input method context unavailable");
                    }
                })?;
            }
            if command_menu::install(app).is_err() {
                eprintln!("native menus unavailable; visible controls remain available");
            }
            if let (Ok(runtime), Ok(cache)) = (
                app.path()
                    .resolve("pdf-helper", tauri::path::BaseDirectory::Resource),
                app.path().app_cache_dir(),
            ) && app
                .state::<PublicationHost>()
                .initialize(runtime, cache.join("publication"))
                .is_err()
            {
                eprintln!("publication cache unavailable");
            }
            // Resolve only. Startup review does not initialize/create the writer store or a source.
            let root = app.path().app_data_dir().ok();
            *app.state::<RecoveryHost>()
                .root
                .lock()
                .map_err(|_| std::io::Error::other("recovery host unavailable"))? = root.clone();
            #[cfg(target_os = "linux")]
            {
                // Tauri creates the app-data directory with default modes; the
                // native stores require a private 0700 root. Restrict a
                // uid-owned root (never loosen) before any host initializes.
                // A refusal below leaves the hosts uninitialized; commands
                // then report nativeUnavailable instead of inventing state.
                if let Some(ref dir) = root
                    && let Err(error) = screenwriter_core::documents::ensure_private_app_dir(dir)
                {
                    eprintln!("private app directory unavailable: {error:?}");
                }
                // Production writer store lives in private app data only. A
                // failure leaves the host uninitialized; entry commands then
                // report nativeUnavailable instead of inventing a manuscript.
                if let Some(dir) = root
                    && screenwriter_core::documents::ensure_private_app_dir(&dir).is_ok()
                    && let Ok(service) = DocumentService::new(&dir)
                    && let Ok(mut host) = app.state::<DocumentHost>().service.lock()
                {
                    *host = Some(service);
                    if let Ok(service) = DocumentService::new(&dir)
                        && let Ok(mut spelling) = app.state::<SpellcheckHost>().service.lock()
                    {
                        *spelling = Some(service);
                    }
                }
            }
            #[cfg(all(feature = "editor-composition-proof", target_os = "linux"))]
            editor_composition_proof::initialize(app)?;
            Ok(())
        });
    #[cfg(target_os = "linux")]
    let builder = builder.manage(SpellcheckHost::default());
    #[cfg(all(
        feature = "native-editor-proof",
        not(all(feature = "editor-composition-proof", target_os = "linux"))
    ))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        update_command_menu,
        render_publication,
        cancel_publication,
        #[cfg(target_os = "linux")]
        spellcheck,
        read_open_document,
        create_unsaved_draft,
        open_source_via_picker,
        #[cfg(target_os = "linux")]
        list_recent_projects,
        #[cfg(target_os = "linux")]
        remove_recent_project,
        #[cfg(target_os = "linux")]
        open_recent_project,
        #[cfg(target_os = "linux")]
        locate_recent_project,
        #[cfg(target_os = "linux")]
        confirm_recent_location,
        select_destination,
        select_save_destination,
        save_as_copy,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        list_document_recovery,
        read_document_recovery,
        resume_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        protect_workflow,
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
        update_command_menu,
        render_publication,
        cancel_publication,
        #[cfg(target_os = "linux")]
        spellcheck,
        read_open_document,
        create_unsaved_draft,
        open_source_via_picker,
        #[cfg(target_os = "linux")]
        list_recent_projects,
        #[cfg(target_os = "linux")]
        remove_recent_project,
        #[cfg(target_os = "linux")]
        open_recent_project,
        #[cfg(target_os = "linux")]
        locate_recent_project,
        #[cfg(target_os = "linux")]
        confirm_recent_location,
        select_destination,
        select_save_destination,
        save_as_copy,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        list_document_recovery,
        read_document_recovery,
        resume_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        protect_workflow,
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
        update_command_menu,
        render_publication,
        cancel_publication,
        #[cfg(target_os = "linux")]
        spellcheck,
        read_open_document,
        create_unsaved_draft,
        open_source_via_picker,
        #[cfg(target_os = "linux")]
        list_recent_projects,
        #[cfg(target_os = "linux")]
        remove_recent_project,
        #[cfg(target_os = "linux")]
        open_recent_project,
        #[cfg(target_os = "linux")]
        locate_recent_project,
        #[cfg(target_os = "linux")]
        confirm_recent_location,
        select_destination,
        select_save_destination,
        save_as_copy,
        release_open_document,
        release_open_document_at_risk,
        list_local_recovery,
        read_local_recovery,
        list_document_recovery,
        read_document_recovery,
        resume_local_recovery,
        checkpoint_document,
        protect_fountain_import,
        protect_workflow,
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
mod save_as_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod document_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod recovery_choices_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod startup_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod snapshot_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod recent_projects_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod workflow_protection_ipc_tests;

#[cfg(all(test, target_os = "linux"))]
mod publication_ipc_tests;
