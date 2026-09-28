//! Generated MockRuntime dispatch with real owned files, not native WebView evidence.
use super::*;
use screenwriter_core::documents::{
    choices::{CompareRequest, RecoverRequest, RecoveryComparison},
    recovery::source_hash,
    saving::SaveReceipt,
    startup::{RecoveryOrigin, RecoverySelection},
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

struct Harness {
    root: std::path::PathBuf,
    opened: OpenDocument,
    fingerprint: screenwriter_core::documents::DiskFingerprint,
    selection: RecoverySelection,
}

impl Harness {
    fn setup(source_bytes: &[u8], recovery_bytes: &[u8]) -> (Self, DocumentHost) {
        let base = std::env::var_os("BABEL_IPC_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!(
            "babel-choices-ipc-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(root.join("source.fountain"), source_bytes).unwrap();
        fs::set_permissions(
            root.join("source.fountain"),
            fs::Permissions::from_mode(0o600),
        )
        .unwrap();
        let mut service = DocumentService::new(&root.join("app-data")).unwrap();
        let opened = service
            .open_selected(&root.join("source.fountain"))
            .unwrap();
        service
            .checkpoint(
                &opened.identity,
                21,
                recovery_bytes,
                &source_hash(recovery_bytes),
                json!({"draft": true}),
            )
            .unwrap();
        let selection = service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .map(|checkpoint| RecoverySelection {
                document_id: checkpoint.metadata.document_id.clone(),
                origin: RecoveryOrigin::Current,
                record_sha256: source_hash(&checkpoint.encode().unwrap()),
            })
            .unwrap();
        let fingerprint = opened.fingerprint.clone().unwrap();
        let host = DocumentHost {
            service: Arc::new(Mutex::new(Some(service))),
            ..Default::default()
        };
        (
            Self {
                root,
                opened,
                fingerprint,
                selection,
            },
            host,
        )
    }

    fn app(&self, host: DocumentHost) -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .manage(host)
            .invoke_handler(tauri::generate_handler![
                compare_recovery,
                recover_checkpoint_as_current,
                keep_current_source,
                save_recovered_copy,
                resolve_save_transaction
            ])
            .build(mock_context(noop_assets()))
            .unwrap()
    }

    fn compare_body(&self) -> Value {
        serde_json::to_value(CompareRequest {
            identity: self.opened.identity.clone(),
            selection: self.selection.clone(),
        })
        .unwrap()
    }
}

impl Drop for Harness {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

#[test]
fn choice_commands_compare_adopt_keep_copy_and_resolve_without_paths() {
    let (harness, host) = Harness::setup(b"original", b"edited");
    let app = harness.app(host);
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();

    let wire = invoke(
        &webview,
        "compare_recovery",
        json!({"request": harness.compare_body()}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(wire["identical"], json!(false));
    assert_eq!(
        wire["recovery"]["sourceSha256"],
        json!(source_hash(b"edited"))
    );
    assert_eq!(wire["source"]["status"], json!("current"));
    let compared: RecoveryComparison = serde_json::from_value(wire).unwrap();
    assert_eq!(compared.selection, harness.selection);

    // Strict path-free envelopes on every choice command.
    for cmd in [
        "compare_recovery",
        "recover_checkpoint_as_current",
        "keep_current_source",
        "save_recovered_copy",
        "resolve_save_transaction",
    ] {
        assert!(
            invoke(
                &webview,
                cmd,
                json!({"request": {"path": "/private/manuscript"}}),
            )
            .is_err(),
            "{cmd} must reject a path-bearing request"
        );
    }
    let mut nested = harness.compare_body();
    nested["identity"]["path"] = json!("/private/manuscript");
    assert!(invoke(&webview, "compare_recovery", json!({"request": nested})).is_err());

    // Stale and foreign selections fail instead of substituting a generation.
    let mut stale = harness.compare_body();
    stale["selection"]["recordSha256"] = json!("0".repeat(64));
    assert_eq!(
        invoke(&webview, "compare_recovery", json!({"request": stale}),).unwrap_err(),
        json!({"code":"recoveryNeedsAttention","action":"reopenOrSaveCopy"})
    );
    let mut foreign = harness.compare_body();
    foreign["identity"]["sessionId"] = json!("33333333-3333-4333-8333-333333333333");
    assert!(invoke(&webview, "compare_recovery", json!({"request": foreign})).is_err());

    // Explicit keep preserves both and unblocks this session.
    let kept = invoke(
        &webview,
        "keep_current_source",
        json!({"request": {
            "identity": harness.opened.identity.clone(),
            "selection": harness.selection,
            "expectedFingerprint": harness.fingerprint,
        }}),
    )
    .unwrap()
    .deserialize::<RecoveryComparison>()
    .unwrap();
    assert!(!kept.identical);

    // No interrupted transaction is pending on this healthy registration.
    let resolved = invoke(
        &webview,
        "resolve_save_transaction",
        json!({"request": {"identity": harness.opened.identity.clone()}}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(resolved["observation"], json!("noTransaction"));
    assert_eq!(resolved["completed"], Value::Null);

    // The recovered copy lands beside the source with exact bytes.
    let copied = invoke(
        &webview,
        "save_recovered_copy",
        json!({"request": {
            "identity": harness.opened.identity.clone(),
            "selection": harness.selection,
            "expectedFingerprint": harness.fingerprint,
        }}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(copied["sourceSha256"], json!(source_hash(b"edited")));
    let name = copied["fileName"].as_str().unwrap();
    assert!(name.starts_with("source.fountain.recovered-"));
    assert_eq!(fs::read(harness.root.join(name)).unwrap(), b"edited");

    // Protected adoption replaces the source and retains the previous copy.
    let saved = invoke(
        &webview,
        "recover_checkpoint_as_current",
        json!({"request": {
            "identity": harness.opened.identity.clone(),
            "selection": harness.selection,
            "newVersion": 22,
            "expectedFingerprint": harness.fingerprint,
        }}),
    )
    .unwrap()
    .deserialize::<SaveReceipt>()
    .unwrap();
    assert_eq!(saved.version, 22);
    assert_eq!(saved.source_sha256, source_hash(b"edited"));
    assert_eq!(
        fs::read(harness.root.join("source.fountain")).unwrap(),
        b"edited"
    );
    drop(webview);
    drop(app);
}

#[test]
fn dispatch_reconciles_an_older_session_only_through_an_explicit_choice() {
    let (harness, host) = Harness::setup(b"original", b"edited");
    // Releasing and reopening starts a new session over the older recovery,
    // mirroring a restart within one cooperating process.
    let reopened = {
        let mut guard = host.service.lock().unwrap();
        let service = guard.as_mut().unwrap();
        service.release(&harness.opened.identity).unwrap();
        service
            .open_selected(&harness.root.join("source.fountain"))
            .unwrap()
    };
    assert_ne!(
        reopened.identity.session_id,
        harness.opened.identity.session_id
    );
    let app = harness.app(host);
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let request: RecoverRequest = serde_json::from_value(json!({
        "identity": reopened.identity,
        "selection": harness.selection,
        "newVersion": 22,
        "expectedFingerprint": reopened.fingerprint.clone().unwrap(),
    }))
    .unwrap();
    let saved = invoke(
        &webview,
        "recover_checkpoint_as_current",
        json!({"request": request}),
    )
    .unwrap()
    .deserialize::<SaveReceipt>()
    .unwrap();
    assert_eq!(saved.version, 22);
    assert_eq!(
        fs::read(harness.root.join("source.fountain")).unwrap(),
        b"edited"
    );
    drop(webview);
    drop(app);
}

#[test]
fn uninitialized_choice_host_reports_unavailable_without_touching_disk() {
    let app = mock_builder()
        .manage(DocumentHost::default())
        .invoke_handler(tauri::generate_handler![
            compare_recovery,
            recover_checkpoint_as_current,
            keep_current_source,
            save_recovered_copy,
            resolve_save_transaction
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let identity = json!({
        "handle": "11111111-1111-4111-8111-111111111111",
        "documentId": "22222222-2222-4222-8222-222222222222",
        "sessionId": "33333333-3333-4333-8333-333333333333",
    });
    let selection = json!({
        "documentId": "22222222-2222-4222-8222-222222222222",
        "origin": "current",
        "recordSha256": "a".repeat(64),
    });
    assert_eq!(
        invoke(
            &webview,
            "compare_recovery",
            json!({"request": {"identity": identity, "selection": selection}}),
        )
        .unwrap_err(),
        json!({"code":"nativeUnavailable","action":"retry"})
    );
    assert!(
        invoke(
            &webview,
            "keep_current_source",
            json!({"request": {
                "identity": identity,
                "selection": selection,
                "expectedFingerprint": null,
            }}),
        )
        .is_err()
    );
    drop(webview);
    drop(app);
}
