use screenwriter_core::AppInfo;

#[tauri::command]
fn app_info() -> AppInfo {
    screenwriter_core::app_info()
}

#[cfg(feature = "native-editor-proof")]
#[tauri::command]
fn record_native_editor_proof(report: String) -> Result<(), &'static str> {
    if report.len() > 16_384 {
        return Err("proof report exceeds limit");
    }
    eprintln!("M1_NATIVE_EDITOR_PROOF {report}");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "native-editor-proof")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_info,
        record_native_editor_proof
    ]);
    #[cfg(not(feature = "native-editor-proof"))]
    let builder = builder.invoke_handler(tauri::generate_handler![app_info]);
    builder
        .run(tauri::generate_context!())
        .expect("error while running babel desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_exposes_core_build_information() {
        assert_eq!(app_info(), screenwriter_core::app_info());
    }

    #[cfg(feature = "native-editor-proof")]
    #[test]
    fn native_proof_report_has_a_size_limit() {
        assert_eq!(
            record_native_editor_proof("x".repeat(16_385)),
            Err("proof report exceeds limit")
        );
    }
}
