//! M3-09 native entry dispatch. Generated MockRuntime invocation with real
//! Linux files; OS picker display itself is cancelled headlessly (see
//! `document_entry_host` test stubs) and stays a real-display M3-12 drill.
use super::*;
use screenwriter_core::documents::{
    DocumentKind, Ownership,
    persistence::CheckpointRequest,
    recovery::source_hash,
    snapshots::{ExternalCopyRequest, SnapshotKind, SnapshotRequest},
};
use serde_json::{Value, json};
use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};
use tauri::test::{mock_builder, mock_context, noop_assets};

fn invoke(
    webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    body: Value,
) -> Result<Value, Value> {
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
    .map(|r| r.deserialize::<Value>().unwrap())
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("BABEL_IPC_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!(
                "babel-entry-ipc-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(root.join("managed.fountain"), b"INT. HOUSE - DAY\n").unwrap();
        fs::set_permissions(
            root.join("managed.fountain"),
            fs::Permissions::from_mode(0o600),
        )
        .unwrap();
        Self(root)
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

fn entry_app(host: DocumentHost) -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            create_unsaved_draft,
            open_source_via_picker,
            select_destination,
            release_open_document,
            checkpoint_document,
            save_external_copy,
        ])
        .build(mock_context(noop_assets()))
        .unwrap()
}

trait DeserializeOpen {
    fn deserialize_open(self) -> OpenDocument;
}

impl DeserializeOpen for Value {
    fn deserialize_open(self) -> OpenDocument {
        serde_json::from_value(self).expect("native OpenDocument envelope")
    }
}

fn checkpoint_for(opened: &OpenDocument, version: u64, source: &[u8]) -> Value {
    json!({"request":{
        "identity": opened.identity,
        "version": version,
        "source": source,
        "sourceSha256": source_hash(source),
        "expectedFingerprint": opened.fingerprint,
        "draftMetadata": {},
    }})
}

#[test]
fn unsaved_draft_allocates_immediate_identity_without_touching_sources() {
    let f = Fixture::new();
    let mut service = f.service();
    let opened = service
        .open_selected(&f.0.join("managed.fountain"))
        .unwrap();
    let app = entry_app(DocumentHost {
        service: std::sync::Arc::new(std::sync::Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let first = invoke(&webview, "create_unsaved_draft", json!({"request": {}}))
        .unwrap()
        .deserialize_open();
    assert_eq!(first.kind, DocumentKind::Unsaved);
    assert_eq!(first.ownership, Ownership::Exclusive);
    assert!(first.source.is_empty());
    assert!(first.fingerprint.is_none());
    assert!(!first.persistent_identity);
    let second = invoke(&webview, "create_unsaved_draft", json!({"request": {}}))
        .unwrap()
        .deserialize_open();
    assert_ne!(first.identity, second.identity);
    // The pre-existing registration is untouched and still readable.
    let reread = app
        .state::<DocumentHost>()
        .service
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .read_initial(&opened.identity)
        .unwrap();
    assert_eq!(reread, opened);
    // An unsaved identity is immediately recoverable: first checkpoint succeeds.
    let receipt = invoke(
        &webview,
        "checkpoint_document",
        checkpoint_for(&first, 1, b"new draft"),
    )
    .unwrap();
    assert_eq!(receipt["version"], 1);
    assert_eq!(
        fs::read(f.0.join("managed.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    drop(webview);
    drop(app);
}

#[test]
fn picker_cancel_preserves_registration_recovery_and_tokens() {
    let f = Fixture::new();
    let mut service = f.service();
    let opened = service
        .open_selected(&f.0.join("managed.fountain"))
        .unwrap();
    let destination = service
        .select_copy_destination(&opened.identity, &f.0)
        .unwrap();
    let app = entry_app(DocumentHost {
        service: std::sync::Arc::new(std::sync::Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    // Headless picker cancellation is a null result, never an error or new registration.
    assert_eq!(
        invoke(&webview, "open_source_via_picker", json!({"request": {}})).unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &webview,
            "select_destination",
            json!({"request": opened.identity}),
        )
        .unwrap(),
        Value::Null
    );
    // Registration, recovery and the earlier token all survive cancellation.
    let reread = app
        .state::<DocumentHost>()
        .service
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .read_initial(&opened.identity)
        .unwrap();
    assert_eq!(reread, opened);
    let checkpoint = CheckpointRequest {
        identity: opened.identity.clone(),
        version: 21,
        source: b"protected".to_vec(),
        source_sha256: source_hash(b"protected"),
        expected_fingerprint: opened.fingerprint.clone(),
        draft_metadata: json!({}),
    };
    let receipt = invoke(
        &webview,
        "checkpoint_document",
        json!({"request": checkpoint}),
    )
    .unwrap();
    assert_eq!(receipt["version"], 21);
    let copy = invoke(
        &webview,
        "save_external_copy",
        json!({"request": {
            "checkpoint": checkpoint,
            "destinationToken": destination.token,
        }}),
    )
    .unwrap();
    assert_eq!(copy["version"], 21);
    assert_eq!(
        fs::read(f.0.join("managed.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    drop(webview);
    drop(app);
}

#[test]
fn entry_commands_reject_paths_and_stale_sessions_without_state_change() {
    let f = Fixture::new();
    let mut service = f.service();
    let opened = service
        .open_selected(&f.0.join("managed.fountain"))
        .unwrap();
    let snapshot_request = SnapshotRequest {
        checkpoint: CheckpointRequest {
            identity: opened.identity.clone(),
            version: 21,
            source: b"entry".to_vec(),
            source_sha256: source_hash(b"entry"),
            expected_fingerprint: opened.fingerprint.clone(),
            draft_metadata: json!({}),
        },
        kind: SnapshotKind::Rolling,
        name: None,
    };
    let app = entry_app(DocumentHost {
        service: std::sync::Arc::new(std::sync::Mutex::new(Some(service))),
        ..Default::default()
    });
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    // No frontend-supplied path reaches any entry command.
    for (command, body) in [
        (
            "create_unsaved_draft",
            json!({"request": {"path": "/arbitrary/draft.fountain"}}),
        ),
        (
            "open_source_via_picker",
            json!({"request": {"path": "/arbitrary/source.fountain"}}),
        ),
        (
            "select_destination",
            json!({"request": {
                "handle": opened.identity.handle,
                "documentId": opened.identity.document_id,
                "sessionId": opened.identity.session_id,
                "path": "/arbitrary/destination",
            }}),
        ),
    ] {
        assert!(invoke(&webview, command, body).is_err(), "{command}");
    }
    // A stale session fails before any native picker or token is issued.
    let mut stale = opened.identity.clone();
    stale.session_id = "00000000-0000-4000-8000-000000000000".to_string();
    assert_eq!(
        invoke(&webview, "select_destination", json!({"request": stale})).unwrap_err(),
        json!({"code": "identityMismatch", "action": "retry"})
    );
    // A destination token bound to another registration cannot copy here.
    let foreign: ExternalCopyRequest = serde_json::from_value(json!({
        "checkpoint": snapshot_request.checkpoint,
        "destinationToken": "00000000-0000-4000-8000-000000000000",
    }))
    .unwrap();
    assert_eq!(
        invoke(&webview, "save_external_copy", json!({"request": foreign}),).unwrap_err(),
        json!({"code": "invalidDestination", "action": "retry"})
    );
    assert!(
        invoke(
            &webview,
            "open_document",
            json!({"path": f.0.join("managed.fountain")}),
        )
        .is_err()
    );
    assert_eq!(
        fs::read(f.0.join("managed.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    drop(webview);
    drop(app);
}

#[test]
fn release_revokes_destination_tokens_and_uninitialized_host_reports_unavailable() {
    let f = Fixture::new();
    let mut service = f.service();
    let opened = service
        .open_selected(&f.0.join("managed.fountain"))
        .unwrap();
    let destination = service
        .select_copy_destination(&opened.identity, &f.0)
        .unwrap();
    let host = DocumentHost {
        service: std::sync::Arc::new(std::sync::Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = entry_app(host);
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    invoke(
        &webview,
        "release_open_document",
        json!({"request": opened.identity}),
    )
    .unwrap();
    // The revoked registration and token cannot publish a copy after release.
    let checkpoint = CheckpointRequest {
        identity: opened.identity.clone(),
        version: 21,
        source: b"after release".to_vec(),
        source_sha256: source_hash(b"after release"),
        expected_fingerprint: opened.fingerprint.clone(),
        draft_metadata: json!({}),
    };
    assert_eq!(
        invoke(
            &webview,
            "save_external_copy",
            json!({"request": {
                "checkpoint": checkpoint,
                "destinationToken": destination.token,
            }}),
        )
        .unwrap_err(),
        json!({"code": "invalidHandle", "action": "retry"})
    );
    assert_eq!(
        invoke(
            &webview,
            "select_destination",
            json!({"request": opened.identity}),
        )
        .unwrap_err(),
        json!({"code": "invalidHandle", "action": "retry"})
    );
    drop(webview);
    drop(app);

    // An uninitialized production host reports unavailability without a dialog.
    let bare = entry_app(DocumentHost::default());
    let bare_view = tauri::WebviewWindowBuilder::new(&bare, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(&bare_view, "create_unsaved_draft", json!({"request": {}})).unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    assert_eq!(
        invoke(&bare_view, "open_source_via_picker", json!({"request": {}})).unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    assert_eq!(
        invoke(
            &bare_view,
            "select_destination",
            json!({"request": opened.identity}),
        )
        .unwrap_err(),
        json!({"code": "nativeUnavailable", "action": "retry"})
    );
    assert_eq!(
        fs::read(f.0.join("managed.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    drop(bare_view);
    drop(bare);
}
