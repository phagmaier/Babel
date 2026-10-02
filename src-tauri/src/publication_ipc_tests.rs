//! MockRuntime dispatch with real helper and disposable native document; not WebView evidence.
use super::*;
use publication_host::*;
use screenwriter_core::documents::recovery::source_hash;
use serde_json::{Value, json};
use tauri::test::{mock_builder, mock_context, noop_assets};
fn invoke(
    view: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    body: Value,
) -> Result<tauri::ipc::InvokeResponseBody, Value> {
    tauri::test::get_ipc_response(
        view,
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
fn publication_ipc_strict_owned_path_free_and_isolated_from_save_recovery() {
    let base = std::env::var_os("BABEL_PUBLICATION_TEST_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let root = base.join(format!(
        "babel-publication-ipc-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&root).unwrap();
    let source_path = root.join("synthetic.fountain");
    let original = b"!Original source.\r\n";
    std::fs::write(&source_path, original).unwrap();
    let mut service = DocumentService::new(&root.join("data")).unwrap();
    let opened = service.open_selected(&source_path).unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let publication = host.publication.clone();
    publication
        .initialize(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../target/pdf-helper/runtime")
                .canonicalize()
                .unwrap(),
            root.join("cache"),
        )
        .unwrap();
    let app = mock_builder()
        .manage(host)
        .manage(publication)
        .invoke_handler(tauri::generate_handler![
            render_publication,
            read_publication,
            cancel_publication,
            release_open_document
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let capture = b"\xef\xbb\xbfINT. ROOM - DAY\r\n\r\nA light.\r\n";
    let before = stored_bytes(&root.join("data"));
    let body = json!({"request":{"identity":opened.identity,"requestId":1,"version":7,"source":capture,"sourceSha256":source_hash(capture),"profile":PROFILE,"fontSet":FONT_SET,"options":{}}});
    for (parent, key, value) in [
        ("/request", "path", json!("/outside")),
        ("/request/options", "shell", json!("sh")),
        ("/request/identity", "path", json!("/outside")),
        ("/request", "source", json!([256])),
        ("/request", "version", json!(0)),
        ("/request", "sourceSha256", json!(source_hash(original))),
    ] {
        let mut invalid = body.clone();
        invalid
            .pointer_mut(parent)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert(key.into(), value);
        assert!(
            invoke(&view, "render_publication", invalid).is_err(),
            "{key}"
        );
    }
    for field in ["handle", "documentId", "sessionId"] {
        let mut foreign = body.clone();
        foreign["request"]["identity"][field] = json!("foreign");
        assert_eq!(
            invoke(&view, "render_publication", foreign).unwrap_err(),
            json!("invalid-identity")
        );
    }
    let result = invoke(&view, "render_publication", body.clone())
        .unwrap()
        .deserialize::<RenderResult>()
        .unwrap();
    assert_eq!(result.version, 7);
    assert_eq!(result.source_sha256, source_hash(capture));
    assert_eq!(result.page_count, 1);
    assert!(result.profile_frozen);
    assert!(!result.artifact.contains('/'));
    let read_body =
        json!({"request":{"identity":opened.identity,"requestId":1,"artifact":result.artifact}});
    let binary = invoke(&view, "read_publication", read_body.clone()).unwrap();
    match binary {
        tauri::ipc::InvokeResponseBody::Raw(bytes) => assert!(bytes.starts_with(b"%PDF-")),
        _ => panic!("preview must use binary IPC"),
    }
    for (key, value) in [
        ("path", json!("/outside")),
        ("artifact", json!("../outside")),
        ("requestId", json!(2)),
    ] {
        let mut invalid = read_body.clone();
        invalid["request"][key] = value;
        assert!(invoke(&view, "read_publication", invalid).is_err());
    }
    let permit = app
        .state::<DocumentHost>()
        .reserve(screenwriter_core::documents::saving::MAX_QUEUED_BYTES)
        .unwrap();
    assert_eq!(
        invoke(&view, "render_publication", body.clone()).unwrap_err(),
        json!("queue-full")
    );
    drop(permit);
    assert!(
        invoke(
            &view,
            "cancel_publication",
            json!({"request":{"identity":opened.identity,"requestId":1,"path":"/outside"}})
        )
        .is_err()
    );
    let mut stale = body.clone();
    stale["request"]["requestId"] = json!(2);
    stale["request"]["version"] = json!(6);
    assert_eq!(
        invoke(&view, "render_publication", stale).unwrap_err(),
        json!("stale-version")
    );
    assert!(
        root.join("cache")
            .join(format!("{}.pdf", result.artifact))
            .exists()
    );
    assert_eq!(stored_bytes(&root.join("data")), before);
    invoke(
        &view,
        "release_open_document",
        json!({"request":opened.identity}),
    )
    .unwrap();
    assert_eq!(
        std::fs::read_dir(root.join("cache"))
            .unwrap()
            .filter(|e| e
                .as_ref()
                .unwrap()
                .path()
                .extension()
                .is_some_and(|x| x == "pdf"))
            .count(),
        0
    );
    assert_eq!(std::fs::read(&source_path).unwrap(), original);
    // No recovery checkpoint was created by publication.
    assert!(
        app.state::<DocumentHost>()
            .service
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .read_initial(&opened.identity)
            .is_err()
    );
    drop(view);
    drop(app);
    std::fs::remove_dir_all(root).unwrap();
}

fn stored_bytes(root: &std::path::Path) -> std::collections::BTreeMap<std::path::PathBuf, Vec<u8>> {
    let mut result = std::collections::BTreeMap::new();
    for entry in std::fs::read_dir(root).unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_dir() {
            result.extend(stored_bytes(&entry.path()));
        } else if entry.file_type().unwrap().is_file() {
            result.insert(entry.path(), std::fs::read(entry.path()).unwrap());
        }
    }
    result
}
