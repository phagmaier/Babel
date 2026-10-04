//! Generated MockRuntime dispatch with real Linux files; not native WebView evidence.
use super::*;
use crate::test_support::TestRoot;
use screenwriter_core::documents::{
    persistence::CheckpointRequest, recovery::source_hash, snapshots::*,
};
use serde_json::{Value, json};
use std::{fs, os::unix::fs::PermissionsExt};
use tauri::test::{mock_builder, mock_context, noop_assets};
fn invoke(
    view: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    request: Value,
) -> Result<Value, Value> {
    crate::test_support::invoke(view, cmd, json!({"request": request}))
}
struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_IPC_TEST_ROOT", "babel-snapshot-ipc");
        Self(root)
    }
}
#[test]
fn commands_snapshot_preview_copy_restore_and_prune_without_paths() {
    let f = Fixture::new();
    let source = f.0.join("source.fountain");
    fs::write(&source, b"original\r\n").unwrap();
    fs::set_permissions(&source, fs::Permissions::from_mode(0o600)).unwrap();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&source).unwrap();
    let destination = service
        .select_copy_destination(&opened.identity, &f.0)
        .unwrap();
    let c = CheckpointRequest {
        identity: opened.identity.clone(),
        version: 21,
        source: b"snapshot  \n".to_vec(),
        source_sha256: source_hash(b"snapshot  \n"),
        expected_fingerprint: opened.fingerprint.clone(),
        draft_metadata: json!({"keep":true}),
    };
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            list_snapshots,
            read_snapshot,
            create_snapshot,
            prune_snapshots,
            restore_snapshot,
            save_external_copy
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let entry: SnapshotEntry = serde_json::from_value(
        invoke(
            &view,
            "create_snapshot",
            serde_json::to_value(SnapshotRequest {
                checkpoint: c.clone(),
                kind: SnapshotKind::Named,
                name: Some("Named".into()),
            })
            .unwrap(),
        )
        .unwrap(),
    )
    .unwrap();
    let catalog: SnapshotCatalog = serde_json::from_value(
        invoke(
            &view,
            "list_snapshots",
            serde_json::to_value(&opened.identity).unwrap(),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(catalog.entries, vec![entry.clone()]);
    let read = SnapshotReadRequest {
        identity: opened.identity.clone(),
        selection: entry.selection.clone(),
    };
    let preview: SnapshotPreview = serde_json::from_value(
        invoke(&view, "read_snapshot", serde_json::to_value(read).unwrap()).unwrap(),
    )
    .unwrap();
    assert_eq!(preview.source, c.source);
    let copied: ExternalCopyReceipt = serde_json::from_value(
        invoke(
            &view,
            "save_external_copy",
            serde_json::to_value(ExternalCopyRequest {
                format: CopyFormat::Fountain,
                checkpoint: c.clone(),
                destination_token: destination.token,
            })
            .unwrap(),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(fs::read(f.0.join(copied.file_name)).unwrap(), c.source);
    let mut current = c.clone();
    current.source = b"newer live".to_vec();
    current.source_sha256 = source_hash(&current.source);
    current.version = 22;
    let saved = invoke(
        &view,
        "restore_snapshot",
        serde_json::to_value(RestoreSnapshotRequest {
            replacement_metadata: None,
            current,
            selection: entry.selection,
            new_version: 23,
            expected_fingerprint: opened.fingerprint.unwrap(),
        })
        .unwrap(),
    )
    .unwrap();
    assert_eq!(saved["version"], 23);
    assert_eq!(saved["protection"], "sourceFile");
    assert_eq!(fs::read(source).unwrap(), c.source);
    let after = invoke(
        &view,
        "prune_snapshots",
        serde_json::to_value(opened.identity).unwrap(),
    )
    .unwrap();
    assert_eq!(after["needsAttention"], false);
}
#[test]
fn malformed_snapshot_envelopes_and_uninitialized_host_fail_closed() {
    let app = mock_builder()
        .manage(DocumentHost::default())
        .invoke_handler(tauri::generate_handler![
            list_snapshots,
            read_snapshot,
            create_snapshot,
            prune_snapshots,
            restore_snapshot,
            save_external_copy
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let id = json!({"handle":"11111111-1111-4111-8111-111111111111","documentId":"22222222-2222-4222-8222-222222222222","sessionId":"33333333-3333-4333-8333-333333333333"});
    for cmd in ["list_snapshots", "prune_snapshots"] {
        assert_eq!(
            invoke(&view, cmd, id.clone()).unwrap_err()["code"],
            "nativeUnavailable"
        );
        let mut bad = id.clone();
        bad["path"] = json!("/tmp/arbitrary");
        assert!(invoke(&view, cmd, bad).is_err());
    }
    let c = json!({"identity":id,"version":21,"source":[0,255],"sourceSha256":source_hash(&[0,255]),"expectedFingerprint":null,"draftMetadata":{}});
    for (cmd, body) in [
        (
            "create_snapshot",
            json!({"checkpoint":c,"kind":"named","name":"Name"}),
        ),
        (
            "save_external_copy",
            json!({"checkpoint":c,"destinationToken":"opaque"}),
        ),
    ] {
        assert_eq!(
            invoke(&view, cmd, body.clone()).unwrap_err()["code"],
            "nativeUnavailable"
        );
        let mut bad = body.clone();
        bad["destinationPath"] = json!("/tmp/arbitrary");
        assert!(invoke(&view, cmd, bad).is_err());
        let mut bad = body;
        bad["checkpoint"]["source"] = json!([-1]);
        assert!(invoke(&view, cmd, bad).is_err());
    }
}
