//! Generated MockRuntime dispatch with real owned files, not native WebView evidence.
use super::*;
use screenwriter_core::documents::{
    LocalRecoveryReader, recovery::source_hash, startup::RecoveryCatalog,
};
use serde_json::{Value, json};
use std::{fs, os::unix::fs::PermissionsExt};
use tauri::test::{mock_builder, mock_context, noop_assets};

fn invoke(
    webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    body: Value,
) -> Result<tauri::ipc::InvokeResponseBody, Value> {
    tauri::test::get_ipc_response(
        webview,
        tauri::webview::InvokeRequest {
            cmd: cmd.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "tauri://localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
}

#[test]
fn selected_recovery_and_resume_commands_are_path_free_exact_and_registration_bound() {
    let base = std::env::var_os("BABEL_STARTUP_TEST_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let root = base.join(format!(
        "babel-resume-ipc-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&root).unwrap();
    fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
    let mut service = DocumentService::new(&root.join("store")).unwrap();
    let document = service.register_unsaved().unwrap();
    let source = b"!Full selected recovery.\r\n".repeat(6000);
    service
        .checkpoint(
            &document.identity,
            21,
            &source,
            &source_hash(&source),
            json!({"unknown":true}),
        )
        .unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            list_document_recovery,
            read_document_recovery,
            resume_local_recovery
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let entry = invoke(
        &view,
        "list_document_recovery",
        json!({"request":document.identity}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    let selection = &entry["candidates"][0]["selection"];
    let preview = invoke(
        &view,
        "read_document_recovery",
        json!({"request":{"identity":document.identity,"selection":selection}}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(preview["source"], json!(source));
    assert!(preview.get("protection").is_none());
    let resumed = invoke(&view, "resume_local_recovery", json!({"request":selection}))
        .unwrap()
        .deserialize::<Value>()
        .unwrap();
    assert_eq!(resumed["document"]["source"], json!(source));
    assert_ne!(
        resumed["document"]["identity"]["documentId"],
        document.identity.document_id
    );
    let mut wrong = serde_json::to_value(&document.identity).unwrap();
    wrong["path"] = json!("/private/manuscript");
    assert!(invoke(&view, "list_document_recovery", json!({"request":wrong})).is_err());
    assert!(
        invoke(
            &view,
            "read_document_recovery",
            json!({"request":{"identity":wrong,"selection":selection}})
        )
        .is_err()
    );
    let mut extra = selection.clone();
    extra["path"] = json!("/private/manuscript");
    assert!(invoke(&view, "resume_local_recovery", json!({"request":extra})).is_err());
    let mut foreign = selection.clone();
    foreign["documentId"] = json!("11111111-1111-4111-8111-111111111111");
    assert!(
        invoke(
            &view,
            "read_document_recovery",
            json!({"request":{"identity":document.identity,"selection":foreign}})
        )
        .is_err()
    );
    drop(app);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn startup_commands_review_exact_raw_generation_reject_stale_and_path_requests_without_writer() {
    let base = std::env::var_os("BABEL_STARTUP_TEST_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let root = base.join(format!(
        "babel-startup-ipc-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&root).unwrap();
    fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
    let store = root.join("store");
    let mut service = DocumentService::new(&store).unwrap();
    let identity = service.register_unsaved().unwrap().identity;
    let raw = b"\xef\xbb\xbfRAW\r\n  \xff";
    service
        .checkpoint(
            &identity,
            21,
            raw,
            &source_hash(raw),
            json!({"unknown":true}),
        )
        .unwrap();
    drop(service);
    let path = store
        .join("recovery")
        .join(format!("{}.journal", identity.document_id));
    let before = fs::read(&path).unwrap();
    let app = mock_builder()
        .manage(DocumentHost::default())
        .manage(RecoveryHost {
            root: Arc::new(Mutex::new(Some(store.clone()))),
        })
        .invoke_handler(tauri::generate_handler![
            list_local_recovery,
            read_local_recovery
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let wire = invoke(&webview, "list_local_recovery", json!({"request":{}}))
        .unwrap()
        .deserialize::<Value>()
        .unwrap();
    assert_eq!(
        wire["entries"][0]["candidates"][0]["selection"]["origin"],
        "current"
    );
    assert_eq!(wire["truncated"], false);
    let catalog: RecoveryCatalog = serde_json::from_value(wire).unwrap();
    let selection = &catalog.entries[0].candidates[0].selection;
    let wire = invoke(
        &webview,
        "read_local_recovery",
        json!({"request":selection}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(wire["source"], json!(raw));
    assert_eq!(wire["metadata"]["draftMetadata"], json!({"unknown":true}));
    assert!(wire.get("protection").is_none());
    assert!(
        app.state::<DocumentHost>()
            .service
            .lock()
            .unwrap()
            .is_none()
    );
    assert!(
        invoke(
            &webview,
            "list_local_recovery",
            json!({"request":{"path":"/private/manuscript"}})
        )
        .is_err()
    );
    let mut extra = serde_json::to_value(selection).unwrap();
    extra["path"] = json!("/private/manuscript");
    assert!(invoke(&webview, "read_local_recovery", json!({"request":extra})).is_err());
    let mut invalid = serde_json::to_value(selection).unwrap();
    invalid["documentId"] = json!("/private/manuscript");
    assert_eq!(
        invoke(&webview, "read_local_recovery", json!({"request":invalid})).unwrap_err(),
        json!({"code":"invalidCheckpoint","action":"retry"})
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::write(&path, &before[..before.len() - 1]).unwrap();
    assert_eq!(
        invoke(
            &webview,
            "read_local_recovery",
            json!({"request":selection})
        )
        .unwrap_err(),
        json!({"code":"recoveryNeedsAttention","action":"reopenOrSaveCopy"})
    );
    assert!(
        LocalRecoveryReader::open(&store)
            .unwrap()
            .unwrap()
            .catalog()
            .unwrap()
            .entries[0]
            .candidates
            .is_empty()
    );
    drop(webview);
    drop(app);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn unavailable_native_root_is_structured_failure_not_an_empty_successful_scan() {
    let app = mock_builder()
        .manage(DocumentHost::default())
        .manage(RecoveryHost::default())
        .invoke_handler(tauri::generate_handler![
            list_local_recovery,
            read_local_recovery
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(&webview, "list_local_recovery", json!({"request":{}})).unwrap_err(),
        json!({"code":"nativeUnavailable","action":"retry"})
    );
}
