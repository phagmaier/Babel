//! MockRuntime strict command dispatch over real disposable native stores, not WebView tests.
use super::*;
use crate::test_support::TestRoot;
use screenwriter_core::documents::{
    history::WorkflowProtectionReceipt, recovery::source_hash, saving::MAX_QUEUED_BYTES,
};
use serde_json::{Value, json};
use tauri::{
    Manager,
    test::{mock_builder, mock_context, noop_assets},
};
fn invoke(
    view: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    body: Value,
) -> Result<tauri::ipc::InvokeResponseBody, Value> {
    crate::test_support::invoke_raw(view, "protect_workflow", body)
}
#[test]
fn workflow_protection_ipc_is_strict_bounded_owned_and_byte_exact() {
    let mut root = TestRoot::with_options("BABEL_IPC_TEST_ROOT", "babel-workflow-ipc", None, false);
    let file = root.join("synthetic.fountain");
    let original = b"!Source untouched.\r\n";
    let draft = b"\xef\xbb\xbf!Exact draft.\r\n";
    std::fs::write(&file, original).unwrap();
    let mut service = DocumentService::new(&root.join("app-data")).unwrap();
    let opened = service.open_selected(&file).unwrap();
    let host = DocumentHost {
        service: Arc::new(Mutex::new(Some(service))),
        ..Default::default()
    };
    let app = mock_builder()
        .manage(host)
        .invoke_handler(tauri::generate_handler![protect_workflow])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let body = json!({"request":{"operation":"sceneMove","checkpoint":{"identity":opened.identity,"version":7,"source":draft,"sourceSha256":source_hash(draft),"expectedFingerprint":opened.fingerprint,"draftMetadata":{}}}});
    for operation in ["sceneMove", "sectionMove", "fountainImport"] {
        let mut request = body.clone();
        request["request"]["operation"] = json!(operation);
        let receipt = invoke(&view, request)
            .unwrap()
            .deserialize::<WorkflowProtectionReceipt>()
            .unwrap();
        assert_eq!(
            serde_json::to_value(receipt.operation).unwrap(),
            json!(operation)
        );
        assert_eq!(receipt.byte_length, draft.len() as u64);
        assert_eq!(receipt.checkpoint.identity, opened.identity);
        assert_eq!(receipt.checkpoint.version, 7);
        assert_eq!(receipt.revision.version, Some(7));
        assert_eq!(receipt.revision.source_sha256, source_hash(draft));
        assert_eq!(
            receipt.revision.safety_ref,
            Some(format!("refs/safety/{}", receipt.revision.commit_id))
        );
    }
    for (pointer, value) in [
        ("/request/path", json!("/outside")),
        ("/request/label", json!("caller label")),
        ("/request/operation", json!("delete")),
        ("/request/checkpoint/profile", json!("caller")),
        ("/request/checkpoint/identity/path", json!("/outside")),
        ("/request/checkpoint/source", json!([256])),
        ("/request/checkpoint/version", json!(0)),
        (
            "/request/checkpoint/sourceSha256",
            json!(source_hash(original)),
        ),
    ] {
        let mut request = body.clone();
        // pointer_mut cannot insert an unknown field; traverse only the known parent.
        let (parent, key) = pointer.rsplit_once('/').unwrap();
        request
            .pointer_mut(parent)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert(key.into(), value);
        assert!(invoke(&view, request).is_err(), "{pointer}");
    }
    for field in ["handle", "documentId", "sessionId"] {
        let mut request = body.clone();
        request["request"]["checkpoint"]["identity"][field] =
            json!("00000000-0000-4000-8000-000000000001");
        assert!(invoke(&view, request).is_err());
    }
    let mut stale = body.clone();
    stale["request"]["checkpoint"]["version"] = json!(6);
    assert_eq!(
        invoke(&view, stale).unwrap_err()["code"],
        json!("staleRecoveryVersion")
    );
    let permit = app
        .state::<DocumentHost>()
        .reserve(MAX_QUEUED_BYTES)
        .unwrap();
    assert_eq!(
        invoke(&view, body.clone()).unwrap_err()["code"],
        json!("saveQueueFull")
    );
    drop(permit);
    assert!(invoke(&view, body).is_ok());
    assert_eq!(std::fs::read(file).unwrap(), original);
    drop(view);
    drop(app);
    root.cleanup().unwrap();
}
