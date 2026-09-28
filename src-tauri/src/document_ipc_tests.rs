//! Tauri MockRuntime dispatch tests, not native WebView verification.
use super::*;
use serde_json::{Value, json};
use tauri::{
    Manager,
    test::{mock_builder, mock_context, noop_assets},
};

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
            invoke_key: tauri::test::INVOKE_KEY.to_string(),
        },
    )
}

#[test]
fn dispatch_is_path_free_session_bound_byte_exact_and_release_revokes_handle() {
    let root = std::env::temp_dir().join(format!(
        "babel-ipc-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&root).unwrap();
    let mut service = DocumentService::new(&root.join("app-data")).unwrap();
    let source = root.join("synthetic.fountain");
    std::fs::write(&source, b"\xef\xbb\xbfunknown\r\n  \xff").unwrap();
    let opened = service.open_selected(&source).unwrap();
    let host = DocumentHost {
        service: Mutex::new(Some(service)),
    };
    let app = mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            read_open_document,
            release_open_document
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let body = json!({ "request": opened.identity });
    let received = invoke(&webview, "read_open_document", body.clone())
        .unwrap()
        .deserialize::<OpenDocument>()
        .unwrap();
    assert_eq!(received, opened);
    let mut wrong_session = body.clone();
    wrong_session["request"]["sessionId"] = json!("00000000-0000-4000-8000-000000000000");
    assert_eq!(
        invoke(&webview, "read_open_document", wrong_session).unwrap_err(),
        json!({"code": "identityMismatch", "action": "retry"})
    );
    let mut path_injection = body.clone();
    path_injection["request"]["path"] = json!("/arbitrary/source.fountain");
    assert!(invoke(&webview, "read_open_document", path_injection).is_err());
    assert!(
        invoke(
            &webview,
            "write_file",
            json!({"path": source, "source": "overwrite"})
        )
        .is_err()
    );
    invoke(&webview, "release_open_document", body.clone()).unwrap();
    assert_eq!(
        invoke(&webview, "read_open_document", body).unwrap_err(),
        json!({"code": "invalidHandle", "action": "retry"})
    );
    assert_eq!(std::fs::read(&source).unwrap(), opened.source);
    drop(webview);
    drop(app);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn production_default_cannot_open_a_frontend_path_or_claim_native_readiness() {
    let app = mock_builder()
        .manage(DocumentHost::default())
        .invoke_handler(tauri::generate_handler![
            read_open_document,
            release_open_document
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let identity = json!({"handle": "h", "documentId": "d", "sessionId": "s"});
    assert_eq!(
        invoke(&webview, "read_open_document", json!({"request": identity})).unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    assert!(
        invoke(
            &webview,
            "open_document",
            json!({"path": "/arbitrary/source"})
        )
        .is_err()
    );
    assert!(
        app.state::<DocumentHost>()
            .service
            .lock()
            .unwrap()
            .is_none()
    );
}
