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
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
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

struct PersistenceFixture(std::path::PathBuf);
impl PersistenceFixture {
    fn new() -> Self {
        use std::os::unix::fs::PermissionsExt;
        let base = std::env::var_os("BABEL_IPC_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!(
            "babel-persistence-ipc-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        std::fs::write(root.join("source.fountain"), b"original\r\n  ").unwrap();
        std::fs::set_permissions(
            root.join("source.fountain"),
            std::fs::Permissions::from_mode(0o640),
        )
        .unwrap();
        Self(root)
    }
    fn service(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("source.fountain"))
            .unwrap();
        (service, opened)
    }
    fn bytes(&self) -> Vec<u8> {
        std::fs::read(self.0.join("source.fountain")).unwrap()
    }
}
impl Drop for PersistenceFixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}
fn persistence_app(host: DocumentHost) -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            read_open_document,
            release_open_document,
            checkpoint_document,
            save_document
        ])
        .build(mock_context(noop_assets()))
        .unwrap()
}
fn snapshot_body(opened: &OpenDocument, version: u64, source: &[u8]) -> Value {
    json!({"request":{"identity":opened.identity,"version":version,"source":source,"sourceSha256":screenwriter_core::documents::recovery::source_hash(source),"expectedFingerprint":opened.fingerprint,"draftMetadata":{"unknown":"keep","unfinished":"character"}}})
}

#[test]
fn checkpoint_and_source_dispatch_return_exact_distinct_receipts_and_duplicate_flushes() {
    use screenwriter_core::documents::{recovery::*, saving::*};
    use std::os::unix::fs::MetadataExt;
    let f = PersistenceFixture::new();
    let (service, opened) = f.service();
    let app = persistence_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let body = snapshot_body(&opened, 21, b"[[unfinished\r\n  ");
    let recovery = invoke(&webview, "checkpoint_document", body.clone())
        .unwrap()
        .deserialize::<CheckpointReceipt>()
        .unwrap();
    assert_eq!(recovery.identity, opened.identity);
    assert_eq!(recovery.version, 21);
    assert_eq!(
        recovery.protection,
        CheckpointProtection::RecoveryCheckpoint
    );
    assert_eq!(f.bytes(), opened.source);
    let saved = invoke(&webview, "save_document", body)
        .unwrap()
        .deserialize::<SaveReceipt>()
        .unwrap();
    assert_eq!(saved.version, 21);
    assert_eq!(saved.recovery, recovery);
    assert_eq!(saved.protection, SaveProtection::SourceFile);
    assert_eq!(f.bytes(), b"[[unfinished\r\n  ");
    assert_eq!(saved.source_sha256, source_hash(&f.bytes()));
    let inode = std::fs::metadata(f.0.join("source.fountain"))
        .unwrap()
        .ino();
    let mut current = opened.clone();
    current.fingerprint = Some(saved.fingerprint.clone());
    let duplicate = invoke(
        &webview,
        "save_document",
        snapshot_body(&current, 21, &f.bytes()),
    )
    .unwrap()
    .deserialize::<SaveReceipt>()
    .unwrap();
    assert_eq!(duplicate, saved);
    assert_eq!(
        std::fs::metadata(f.0.join("source.fountain"))
            .unwrap()
            .ino(),
        inode
    );
    let stale = invoke(
        &webview,
        "save_document",
        snapshot_body(&current, 20, b"stale snapshot"),
    )
    .unwrap_err();
    assert_eq!(stale["error"]["code"], "staleSaveVersion");
    assert_eq!(stale["replacement"], "sourceUnchanged");
    let wrong = invoke(
        &webview,
        "checkpoint_document",
        snapshot_body(&current, 21, b"different same version"),
    )
    .unwrap_err();
    assert_eq!(wrong["error"]["code"], "checkpointConflict");
    assert_eq!(f.bytes(), b"[[unfinished\r\n  ");
    drop(webview);
    drop(app);
}

#[test]
fn save_dispatch_acknowledges_caret_only_versions_without_replacing_the_source() {
    use screenwriter_core::documents::{recovery::*, saving::*};
    use std::os::unix::fs::MetadataExt;
    let f = PersistenceFixture::new();
    let (service, opened) = f.service();
    let app = persistence_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let stamp = || {
        let m = std::fs::metadata(f.0.join("source.fountain")).unwrap();
        (m.ino(), m.mtime(), m.mtime_nsec())
    };
    let save = |current: &OpenDocument, version: u64, source: &[u8]| {
        invoke(
            &webview,
            "save_document",
            snapshot_body(current, version, source),
        )
        .unwrap()
        .deserialize::<SaveReceipt>()
        .unwrap()
    };
    // Browsing a never-edited file: each caret pause is acknowledged, nothing is rewritten.
    let untouched = stamp();
    for version in 1..4 {
        let moved = save(&opened, version, &opened.source);
        assert_eq!(moved.version, version);
        assert_eq!(moved.recovery.version, version);
        assert_eq!(moved.protection, SaveProtection::SourceFile);
        assert_eq!(Some(&moved.fingerprint), opened.fingerprint.as_ref());
        assert_eq!(moved.source_sha256, source_hash(&opened.source));
    }
    assert_eq!((f.bytes(), stamp()), (opened.source.clone(), untouched));
    let previous =
        f.0.join("app-data/source-save")
            .join(&opened.identity.document_id)
            .join("previous");
    assert!(!previous.exists());
    // A real edit replaces once; later caret pauses keep the earlier generation distinct.
    let edited = save(&opened, 4, b"edited\r\n  ");
    let installed = stamp();
    assert_ne!(installed.0, untouched.0);
    let mut current = opened.clone();
    current.fingerprint = Some(edited.fingerprint.clone());
    let moved = save(&current, 5, b"edited\r\n  ");
    assert_eq!(moved.fingerprint, edited.fingerprint);
    assert_eq!((f.bytes(), stamp()), (b"edited\r\n  ".to_vec(), installed));
    assert_eq!(std::fs::read(&previous).unwrap(), opened.source);
    drop(webview);
    drop(app);
}

#[test]
fn persistence_dispatch_rejects_paths_sessions_hashes_and_versions_without_writing_source() {
    let f = PersistenceFixture::new();
    let (service, opened) = f.service();
    let app = persistence_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for command in ["checkpoint_document", "save_document"] {
        for case in 0..7 {
            let mut body = snapshot_body(&opened, 21, b"local");
            match case {
                0 => body["request"]["path"] = json!("/arbitrary/source"),
                1 => body["request"]["identity"]["path"] = json!("/arbitrary/source"),
                2 => body["request"]["expectedFingerprint"]["path"] = json!("/arbitrary/source"),
                3 => {
                    body["request"]["identity"]["sessionId"] =
                        json!("00000000-0000-4000-8000-000000000000")
                }
                4 => body["request"]["sourceSha256"] = json!("0".repeat(64)),
                5 => body["request"]["version"] = json!(0),
                _ => body["request"]["version"] = json!(1u64 << 53),
            }
            assert!(
                invoke(&webview, command, body).is_err(),
                "{command} case {case}"
            );
            assert_eq!(f.bytes(), opened.source);
        }
    }
    drop(webview);
    drop(app);
}

#[test]
fn external_divergence_and_invalid_utf8_preserve_raw_recovery_with_truthful_file_failure() {
    use screenwriter_core::documents::{recovery::*, saving::*};
    let f = PersistenceFixture::new();
    let (mut service, opened) = f.service();
    let unsaved = service.register_unsaved().unwrap();
    let app = persistence_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let raw = b"\xffunfinished raw";
    let recovery = invoke(
        &webview,
        "checkpoint_document",
        snapshot_body(&unsaved, 1, raw),
    )
    .unwrap()
    .deserialize::<CheckpointReceipt>()
    .unwrap();
    assert_eq!(recovery.source_sha256, source_hash(raw));
    std::fs::write(f.0.join("source.fountain"), b"external writer").unwrap();
    let failure = invoke(
        &webview,
        "save_document",
        snapshot_body(&opened, 21, b"local pending source"),
    )
    .unwrap_err();
    let failure: SaveFailure = serde_json::from_value(failure).unwrap();
    assert_eq!(failure.error.code, ErrorCode::SourceChanged);
    assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(failure.recovery.unwrap().version, 21);
    assert_eq!(f.bytes(), b"external writer");
    let state = app.state::<DocumentHost>();
    assert_eq!(
        state
            .service
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"local pending source"
    );
    drop(webview);
    drop(app);
}

#[test]
fn default_host_returns_structured_unavailable_without_frontend_initialization() {
    let f = PersistenceFixture::new();
    let (service, opened) = f.service();
    drop(service);
    let app = persistence_app(DocumentHost::default());
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for cmd in ["checkpoint_document", "save_document"] {
        let failure = invoke(&webview, cmd, snapshot_body(&opened, 21, b"local")).unwrap_err();
        assert_eq!(failure["identity"], json!(opened.identity));
        assert_eq!(failure["version"], 21);
        assert_eq!(failure["error"]["code"], "nativeUnavailable");
    }
    assert_eq!(f.bytes(), opened.source);
    drop(webview);
    drop(app);
}
