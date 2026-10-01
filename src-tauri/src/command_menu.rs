//! Strict UI command bridge. No path, source, shell, credential or disk access.
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogCommand {
    id: String,
    label: String,
    group: String,
    #[serde(rename = "scope")]
    _scope: String,
    binding: Option<String>,
    unavailable: Option<String>,
}
fn catalog() -> Result<Vec<CatalogCommand>, &'static str> {
    serde_json::from_str(include_str!("../../src/application/commandCatalog.json"))
        .map_err(|_| "menuUnavailable")
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MenuCommand {
    id: String,
    binding: Option<String>,
    enabled: bool,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MenuRequest {
    token: String,
    commands: Vec<MenuCommand>,
}
#[derive(Clone, Serialize)]
struct MenuAction {
    token: String,
    id: String,
}
#[derive(Default)]
pub(crate) struct CommandMenu(Mutex<Option<MenuRequest>>);

fn valid_binding(binding: &str) -> bool {
    let key = binding
        .strip_prefix("Mod+Shift+")
        .or_else(|| binding.strip_prefix("Mod+"));
    key.is_some_and(|key| {
        key.len() == 1
            && key
                .bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
    }) && ![
        "Mod+Q",
        "Mod+W",
        "Mod+R",
        "Mod+Shift+R",
        "Mod+H",
        "Mod+M",
        "Mod+Shift+Q",
        "Mod+Shift+W",
        "Mod+Shift+U",
        "Mod+Shift+E",
        "Mod+Shift+3",
        "Mod+Shift+4",
        "Mod+Shift+5",
    ]
    .contains(&binding)
}
fn validate(request: &MenuRequest) -> Result<Vec<CatalogCommand>, &'static str> {
    if request.token.is_empty()
        || request.token.len() > 96
        || !request
            .token
            .bytes()
            .all(|b| b.is_ascii_hexdigit() || b == b'-' || b == b':')
    {
        return Err("invalidMenuState");
    }
    let commands = catalog()?;
    if commands.len() != request.commands.len() {
        return Err("invalidMenuState");
    }
    let mut bindings = std::collections::HashSet::new();
    for (known, supplied) in commands.iter().zip(&request.commands) {
        if known.id != supplied.id
            || (known.unavailable.is_some() && supplied.enabled)
            || supplied
                .binding
                .as_ref()
                .is_some_and(|binding| !valid_binding(binding) || !bindings.insert(binding))
        {
            return Err("invalidMenuState");
        }
    }
    Ok(commands)
}
fn action(state: &MenuRequest, item_id: &str) -> Option<MenuAction> {
    let id = item_id.strip_prefix(&format!("{}/", state.token))?;
    state
        .commands
        .iter()
        .find(|command| command.id == id && command.enabled)
        .map(|command| MenuAction {
            token: state.token.clone(),
            id: command.id.clone(),
        })
}
fn build_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    request: &MenuRequest,
) -> tauri::Result<Menu<R>> {
    let known =
        catalog().map_err(|_| tauri::Error::Io(std::io::Error::other("menu unavailable")))?;
    let mut menu = MenuBuilder::new(app);
    for group in ["Screenplay", "Edit", "Navigate", "Tools"] {
        let mut submenu = SubmenuBuilder::new(app, group);
        for (command, known) in request
            .commands
            .iter()
            .zip(&known)
            .filter(|(_, known)| known.group == group)
        {
            // No toolkit accelerator: only WebView routing respects IME/forms.
            // Per-publication item IDs reject already-queued old toolkit clicks.
            let hint = command.binding.as_deref().unwrap_or_default().replace(
                "Mod",
                if cfg!(target_os = "macos") {
                    "Command"
                } else {
                    "Ctrl"
                },
            );
            let label = if let Some(reason) = &known.unavailable {
                format!("{} — {}", known.label, reason)
            } else if hint.is_empty() {
                known.label.clone()
            } else {
                format!("{} ({hint})", known.label)
            };
            let item = MenuItem::with_id(
                app,
                format!("{}/{}", request.token, command.id),
                label,
                command.enabled,
                None::<&str>,
            )?;
            submenu = submenu.item(&item);
        }
        menu = menu.item(&submenu.build()?);
    }
    menu.build()
}
pub(crate) fn install(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let initial = MenuRequest {
        token: "0".into(),
        commands: catalog()
            .map_err(std::io::Error::other)?
            .into_iter()
            .map(|known| MenuCommand {
                id: known.id,
                binding: known.binding,
                enabled: false,
            })
            .collect(),
    };
    app.set_menu(build_menu(app.handle(), &initial)?)?;
    app.on_menu_event(|app, event| {
        let selected = app.state::<CommandMenu>().0.lock().ok().and_then(|state| {
            state
                .as_ref()
                .and_then(|state| action(state, event.id().as_ref()))
        });
        if let Some(selected) = selected
            && let Some(window) = app.get_webview_window("main")
        {
            let _ = window.emit("application-command", selected);
        }
    });
    Ok(())
}
#[tauri::command]
pub(crate) fn update_command_menu<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    host: tauri::State<'_, CommandMenu>,
    request: MenuRequest,
) -> Result<(), &'static str> {
    validate(&request)?;
    if app.menu().is_none() {
        return Err("menuUnavailable");
    }
    // Retire before building. Old native IDs/events cannot acquire a new token.
    *host.0.lock().map_err(|_| "menuUnavailable")? = None;
    if let Some(menu) = app.menu() {
        for item in menu.items().map_err(|_| "menuUnavailable")? {
            if let Some(submenu) = item.as_submenu() {
                submenu.set_enabled(false).map_err(|_| "menuUnavailable")?;
            }
        }
    }
    let menu = build_menu(&app, &request).map_err(|_| "menuUnavailable")?;
    app.set_menu(menu).map_err(|_| "menuUnavailable")?;
    *host.0.lock().map_err(|_| "menuUnavailable")? = Some(request);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request() -> MenuRequest {
        MenuRequest {
            token: "abcdef:1".into(),
            commands: catalog()
                .unwrap()
                .into_iter()
                .map(|command| MenuCommand {
                    id: command.id,
                    binding: command.binding,
                    enabled: command.unavailable.is_none(),
                })
                .collect(),
        }
    }
    #[test]
    fn strict_menu_ids_bindings_and_future_actions() {
        let valid = request();
        assert!(validate(&valid).is_ok());
        assert!(action(&valid, "abcdef:1/save").is_some());
        assert!(action(&valid, "abcdef:1/exportPdf").is_none());
        assert!(action(&valid, "/tmp/script").is_none());
        assert!(action(&valid, "abcdef:0/save").is_none());
        assert!(action(&valid, "save").is_none());
        let mut invalid = valid.clone();
        invalid.commands[0].id = "shell".into();
        assert!(validate(&invalid).is_err());
        let mut invalid = valid.clone();
        invalid.commands.push(invalid.commands[0].clone());
        assert!(validate(&invalid).is_err());
        for binding in [
            "Mod+Q",
            "Mod+Shift+U",
            "Alt+F",
            "Mod+F6",
            "Mod+é",
            "Mod+SHIFT+K",
        ] {
            let mut invalid = valid.clone();
            invalid.commands[0].binding = Some(binding.into());
            assert!(validate(&invalid).is_err());
        }
        let mut invalid = valid.clone();
        invalid.commands[0].binding = invalid.commands[1].binding.clone();
        assert!(validate(&invalid).is_err());
        let mut invalid = valid.clone();
        invalid
            .commands
            .iter_mut()
            .find(|command| command.id == "exportPdf")
            .unwrap()
            .enabled = true;
        assert!(validate(&invalid).is_err());
        let mut remapped = valid;
        remapped
            .commands
            .iter_mut()
            .find(|command| command.id == "save")
            .unwrap()
            .binding = Some("Mod+K".into());
        assert!(validate(&remapped).is_ok());
        assert_eq!(
            action(&remapped, "abcdef:1/save").unwrap().token,
            "abcdef:1"
        );
    }
    #[test]
    fn envelopes_reject_payloads_and_disabled_events() {
        let mut valid = request();
        valid
            .commands
            .iter_mut()
            .find(|command| command.id == "save")
            .unwrap()
            .enabled = false;
        assert!(action(&valid, "abcdef:1/save").is_none());
        assert!(
            serde_json::from_value::<MenuRequest>(
                serde_json::json!({"token":"a:1", "commands":[], "path":"/tmp/private"})
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<MenuCommand>(
                serde_json::json!({"id":"save", "binding":null, "enabled":true, "source":"private"})
            )
            .is_err()
        );
        valid.token = "private/path".into();
        assert!(validate(&valid).is_err());
    }
    #[test]
    fn generated_dispatch_rejects_extra_payloads_and_unavailable_host() {
        let app = tauri::test::mock_builder()
            .manage(CommandMenu::default())
            .invoke_handler(tauri::generate_handler![update_command_menu])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let invoke = |body| {
            tauri::test::get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd: "update_command_menu".into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: "tauri://localhost".parse().unwrap(),
                    body: tauri::ipc::InvokeBody::Json(body),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.to_string(),
                },
            )
        };
        assert!(
            invoke(
                serde_json::json!({"request":{"token":"a:1","commands":[],"path":"/tmp/private"}})
            )
            .is_err()
        );
        assert_eq!(
            invoke(serde_json::json!({"request":{"token":"a:1","commands":[]}})).unwrap_err(),
            serde_json::json!("invalidMenuState")
        );
        let valid = request();
        let commands: Vec<_> = valid
            .commands
            .iter()
            .map(|c| serde_json::json!({"id":c.id,"binding":c.binding,"enabled":c.enabled}))
            .collect();
        assert_eq!(
            invoke(serde_json::json!({"request":{"token":valid.token,"commands":commands}}))
                .unwrap_err(),
            serde_json::json!("menuUnavailable")
        );
    }
}
