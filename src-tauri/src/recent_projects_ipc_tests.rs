//! Generated Tauri MockRuntime dispatch with native synthetic files. Not WebView E2E.
use super::*;
use serde_json::{Value, json};
use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};
use tauri::test::{mock_builder, mock_context, noop_assets};

fn invoke(
    w: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    request: Value,
) -> Result<Value, Value> {
    tauri::test::get_ipc_response(
        w,
        tauri::webview::InvokeRequest {
            cmd: cmd.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "tauri://localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(json!({"request":request})),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
    .map(|r| r.deserialize::<Value>().unwrap())
}

fn app(host: DocumentHost) -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            list_recent_projects,
            open_recent_project,
            remove_recent_project,
            locate_recent_project,
            confirm_recent_location,
            release_open_document,
        ])
        .build(mock_context(noop_assets()))
        .unwrap()
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let path = std::env::var_os("BABEL_IPC_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!(
                "babel-recent-ipc-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        fs::create_dir(&path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(
            path.join("native.fountain"),
            b"\xef\xbb\xbfINT. ROOM - DAY\r\n  ",
        )
        .unwrap();
        fs::set_permissions(
            path.join("native.fountain"),
            fs::Permissions::from_mode(0o600),
        )
        .unwrap();
        Self(path)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn recent_dispatch_is_path_free_cancel_safe_and_metadata_only_remove() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("native.fountain")).unwrap();
    service.release(&opened.identity).unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = app(host);
    let w = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let list = invoke(&w, "list_recent_projects", json!({})).unwrap();
    let id = list["entries"][0]["entryId"].clone();
    assert_eq!(list["health"], "ready");
    assert_eq!(list["entries"][0]["availability"], "available");
    assert!(!list.to_string().contains(f.0.to_str().unwrap()));
    for cmd in [
        "open_recent_project",
        "remove_recent_project",
        "locate_recent_project",
    ] {
        assert!(invoke(&w, cmd, json!({"entryId":id,"path":"/not-authorized"})).is_err());
        assert!(invoke(&w, cmd, json!({"entryId":"/private/manuscript"})).is_err());
    }
    assert!(invoke(&w, "list_recent_projects", json!({"path":"/injected"})).is_err());
    assert_eq!(
        invoke(&w, "locate_recent_project", json!({"entryId":id})).unwrap(),
        Value::Null
    ); // headless cancellation stub
    assert_eq!(invoke(&w, "list_recent_projects", json!({})).unwrap(), list);
    assert!(
        invoke(
            &w,
            "confirm_recent_location",
            json!({"entryId":id,"selectionToken":id,"choice":"linkMoved","path":"/injected"})
        )
        .is_err()
    );
    assert_eq!(
        invoke(
            &w,
            "confirm_recent_location",
            json!({"entryId":id,"selectionToken":id,"choice":"linkMoved"})
        )
        .unwrap_err(),
        json!({"code":"invalidRecentSelection","action":"retry"})
    );
    let selected = invoke(&w, "open_recent_project", json!({"entryId":id})).unwrap();
    assert_eq!(selected["document"]["source"], json!(opened.source));
    assert_eq!(
        selected["document"]["identity"]["documentId"],
        opened.identity.document_id
    );
    invoke(
        &w,
        "release_open_document",
        selected["document"]["identity"].clone(),
    )
    .unwrap();
    invoke(&w, "remove_recent_project", json!({"entryId":id})).unwrap();
    assert!(
        invoke(&w, "list_recent_projects", json!({})).unwrap()["entries"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        fs::read(f.0.join("native.fountain")).unwrap(),
        opened.source
    );
    assert_eq!(
        invoke(&w, "open_recent_project", json!({"entryId":id})).unwrap_err(),
        json!({"code":"invalidRecentSelection","action":"retry"})
    );
}

#[test]
fn recent_dispatch_preserves_missing_source_corruption_and_unavailable_failures() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("native.fountain")).unwrap();
    service.release(&opened.identity).unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = app(host);
    let w = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let list = invoke(&w, "list_recent_projects", json!({})).unwrap();
    let id = list["entries"][0]["entryId"].clone();
    fs::remove_file(f.0.join("native.fountain")).unwrap();
    assert_eq!(
        invoke(&w, "open_recent_project", json!({"entryId":id})).unwrap_err(),
        json!({"code":"missingSource","action":"selectSourceAgain"})
    );
    fs::write(f.0.join("app-data/recents.pending"), b"partial").unwrap();
    fs::set_permissions(
        f.0.join("app-data/recents.pending"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    assert_eq!(
        invoke(&w, "list_recent_projects", json!({})).unwrap()["health"],
        "needsAttention"
    );
    assert_eq!(
        invoke(&w, "remove_recent_project", json!({"entryId":id})).unwrap_err(),
        json!({"code":"recentNeedsAttention","action":"retry"})
    );
    let empty = self::app(DocumentHost::default());
    let w = tauri::WebviewWindowBuilder::new(&empty, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(&w, "list_recent_projects", json!({})).unwrap_err(),
        json!({"code":"nativeUnavailable","action":"retry"})
    );
}
