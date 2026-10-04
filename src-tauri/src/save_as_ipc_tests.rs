//! M3-11 Save As dispatch. Generated MockRuntime invocation with real Linux
//! files; the OS save dialog is cancelled headlessly (see `save_as_host`
//! test stubs) while success paths spend natively minted tokens through IPC.
use super::*;
use crate::test_support::TestRoot;
use screenwriter_core::documents::recovery::source_hash;
use serde_json::{Value, json};
use std::fs;
use tauri::test::{mock_builder, mock_context, noop_assets};

use crate::test_support::invoke;

struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_IPC_TEST_ROOT", "babel-save-as-ipc");
        root.write("source.fountain", b"INT. HOUSE - DAY\n", 0o600);
        Self(root)
    }
}

fn save_as_app(host: DocumentHost) -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            select_save_destination,
            save_as_copy,
            release_open_document,
        ])
        .build(mock_context(noop_assets()))
        .unwrap()
}

fn checkpoint(opened: &OpenDocument, version: u64, source: &[u8]) -> Value {
    json!({
        "identity": opened.identity,
        "version": version,
        "source": source,
        "sourceSha256": source_hash(source),
        "expectedFingerprint": opened.fingerprint,
        "draftMetadata": {},
    })
}

#[test]
fn save_as_spends_a_native_token_once_and_mints_a_new_identity() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("source.fountain")).unwrap();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
        .unwrap();
    let app = save_as_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let edited = b"INT. HOUSE - DAY\nSave As bytes.\n";
    let receipt = invoke(
        &webview,
        "save_as_copy",
        json!({"request": {
            "checkpoint": checkpoint(&opened, 21, edited),
            "destinationToken": target.token,
        }}),
    )
    .unwrap();
    assert_eq!(receipt["version"], 21);
    assert_eq!(receipt["sourceSha256"], source_hash(edited));
    assert_eq!(receipt["fileName"], "Copy.fountain");
    assert_ne!(receipt["document"]["identity"], json!(opened.identity));
    assert_eq!(receipt["document"]["kind"], "loose");
    assert_eq!(fs::read(f.0.join("Copy.fountain")).unwrap(), edited);
    // The source registration is untouched; the token is spent.
    let reread = app
        .state::<DocumentHost>()
        .service
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .read_initial(&opened.identity)
        .unwrap();
    assert_eq!(reread.source, opened.source);
    assert_eq!(
        invoke(
            &webview,
            "save_as_copy",
            json!({"request": {
                "checkpoint": checkpoint(&opened, 22, edited),
                "destinationToken": target.token,
            }}),
        )
        .unwrap_err(),
        json!({"code": "invalidDestination", "action": "retry"})
    );
    drop(webview);
    drop(app);
}

#[test]
fn save_dialog_cancel_preserves_everything_and_commands_reject_paths() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("source.fountain")).unwrap();
    let app = save_as_app(DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    // Headless save-dialog cancellation is null, never an error or token.
    assert_eq!(
        invoke(
            &webview,
            "select_save_destination",
            json!({"request": opened.identity}),
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        app.state::<DocumentHost>()
            .service
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .read_initial(&opened.identity)
            .unwrap()
            .source,
        opened.source
    );
    // No frontend-supplied path reaches either command.
    assert!(
        invoke(
            &webview,
            "select_save_destination",
            json!({"request": {
                "handle": opened.identity.handle,
                "documentId": opened.identity.document_id,
                "sessionId": opened.identity.session_id,
                "path": "/arbitrary/Copy.fountain",
            }}),
        )
        .is_err()
    );
    assert!(
        invoke(
            &webview,
            "save_as_copy",
            json!({"request": {
                "checkpoint": checkpoint(&opened, 21, b"new"),
                "destinationToken": "00000000-0000-4000-8000-000000000000",
                "path": "/arbitrary/Copy.fountain",
            }}),
        )
        .is_err()
    );
    // Unknown tokens and stale sessions fail closed with no side effects.
    assert_eq!(
        invoke(
            &webview,
            "save_as_copy",
            json!({"request": {
                "checkpoint": checkpoint(&opened, 21, b"new"),
                "destinationToken": "00000000-0000-4000-8000-000000000000",
            }}),
        )
        .unwrap_err(),
        json!({"code": "invalidDestination", "action": "retry"})
    );
    let mut stale = opened.identity.clone();
    stale.session_id = "00000000-0000-4000-8000-000000000000".to_string();
    assert_eq!(
        invoke(
            &webview,
            "select_save_destination",
            json!({"request": stale})
        )
        .unwrap_err(),
        json!({"code": "identityMismatch", "action": "retry"})
    );
    assert!(
        invoke(
            &webview,
            "save_document",
            json!({"request": checkpoint(&opened, 21, b"new")}),
        )
        .is_err()
    );
    assert_eq!(
        fs::read(f.0.join("source.fountain")).unwrap(),
        opened.source
    );
    assert!(!f.0.join("Copy.fountain").exists());
    drop(webview);
    drop(app);
}

#[test]
fn release_revokes_save_tokens_and_bare_hosts_report_unavailable() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("source.fountain")).unwrap();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
        .unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = save_as_app(host);
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    invoke(
        &webview,
        "release_open_document",
        json!({"request": opened.identity}),
    )
    .unwrap();
    assert_eq!(
        invoke(
            &webview,
            "save_as_copy",
            json!({"request": {
                "checkpoint": checkpoint(&opened, 21, b"new"),
                "destinationToken": target.token,
            }}),
        )
        .unwrap_err(),
        json!({"code": "invalidHandle", "action": "retry"})
    );
    assert!(!f.0.join("Copy.fountain").exists());
    drop(webview);
    drop(app);

    let bare = save_as_app(DocumentHost::default());
    let bare_view = tauri::WebviewWindowBuilder::new(&bare, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(
            &bare_view,
            "select_save_destination",
            json!({"request": opened.identity}),
        )
        .unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    assert_eq!(
        invoke(
            &bare_view,
            "save_as_copy",
            json!({"request": {
                "checkpoint": checkpoint(&opened, 21, b"new"),
                "destinationToken": "opaque",
            }}),
        )
        .unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    drop(bare_view);
    drop(bare);
}
