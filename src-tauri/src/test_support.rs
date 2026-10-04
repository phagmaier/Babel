//! Test-only native fixture/MockRuntime transport support; request shapes stay local.
#[path = "../../tests/support/test_root.rs"]
mod root;
pub(crate) use root::TestRoot;
use serde_json::Value;

pub(crate) fn invoke_raw(
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
pub(crate) fn invoke(
    view: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    cmd: &str,
    body: Value,
) -> Result<Value, Value> {
    invoke_raw(view, cmd, body).map(|response| response.deserialize::<Value>().unwrap())
}
