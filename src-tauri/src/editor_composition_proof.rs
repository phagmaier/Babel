//! M1-06 only: fixed synthetic fixtures; never accepts a frontend path or initializes production.
use super::*;
use std::{
    io,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};

const MARKER: &[u8] = b"babel M1-06 disposable synthetic fixtures\n";
pub(super) struct ProofRoot(PathBuf);

fn validate_root(root: &Path) -> io::Result<()> {
    let refuse = || io::Error::other("M1-06 requires a marked private synthetic root");
    let directory = std::fs::symlink_metadata(root)?;
    let marker_path = root.join("SYNTHETIC-M1-06");
    let marker = std::fs::symlink_metadata(&marker_path)?;
    if !root.is_absolute()
        || std::fs::canonicalize(root)? != root
        || !root.file_name().is_some_and(|name| {
            name.to_string_lossy()
                .starts_with("babel-editor-composition-")
        })
        || !directory.is_dir()
        || directory.mode() & 0o777 != 0o700
        || !marker.is_file()
        || marker.len() != MARKER.len() as u64
        || marker.nlink() != 1
        || marker.mode() & 0o777 != 0o600
        || marker.uid() != directory.uid()
        || std::fs::read(marker_path)? != MARKER
    {
        return Err(refuse());
    }
    Ok(())
}

fn fixture_path(root: &Path, fixture: &str) -> Result<PathBuf, DocumentError> {
    validate_root(root).map_err(|_| DocumentError::new(ErrorCode::UnsafePath))?;
    let file = match fixture {
        "lf" => "lf.fountain",
        "crlf" => "crlf.fountain",
        "no-final-newline" => "no-final-newline.fountain",
        _ => return Err(DocumentError::new(ErrorCode::UnsafePath)),
    };
    Ok(root.join(file))
}

pub(super) fn initialize<R: tauri::Runtime>(
    app: &mut tauri::App<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(
        std::env::var_os("BABEL_EDITOR_COMPOSITION_ROOT").ok_or_else(|| {
            io::Error::other("Set BABEL_EDITOR_COMPOSITION_ROOT to the seeded disposable root")
        })?,
    );
    validate_root(&root)?;
    let service = DocumentService::new(&root.join("app-data"))?;
    *app.state::<DocumentHost>()
        .service
        .lock()
        .map_err(|_| io::Error::other("proof writer unavailable"))? = Some(service);
    // Keep startup discovery isolated too. The production setup remains read-only/uninitialized.
    *app.state::<RecoveryHost>()
        .root
        .lock()
        .map_err(|_| io::Error::other("proof reader unavailable"))? = Some(root.join("app-data"));
    app.manage(ProofRoot(root));
    Ok(())
}

#[tauri::command]
pub(super) async fn open_composition_fixture(
    fixture: String,
    root: tauri::State<'_, ProofRoot>,
    host: tauri::State<'_, DocumentHost>,
) -> Result<OpenDocument, DocumentError> {
    let root = root.0.clone();
    let permit = host.reserve(0)?;
    let host = host.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let path = fixture_path(&root, &fixture)?;
        host.service
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .open_selected(&path)
    })
    .await
    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
}

/// M2-05C diagnostic only: the already marked private synthetic `data/` folder.
#[tauri::command]
pub(super) async fn select_snapshot_proof_destination(
    request: DocumentRequest,
    root: tauri::State<'_, ProofRoot>,
    host: tauri::State<'_, DocumentHost>,
) -> Result<screenwriter_core::documents::snapshots::CopyDestination, DocumentError> {
    let root = root.0.clone();
    let permit = host.reserve(0)?;
    let host = host.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        validate_root(&root).map_err(|_| DocumentError::new(ErrorCode::UnsafePath))?;
        host.service
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
            .as_mut()
            .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
            .select_copy_destination(&request, &root.join("data"))
    })
    .await
    .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
}

#[tauri::command]
pub(super) fn record_composition_proof(report: String) -> Result<(), &'static str> {
    if report.len() > 32_768 {
        return Err("proof report exceeds 32 KiB");
    }
    eprintln!("M1_COMPOSITION_PROOF {report}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let base = std::env::var_os("BABEL_COMPOSITION_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let root = base.join(format!(
                "babel-editor-composition-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir(&root).unwrap();
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
            std::fs::write(root.join("SYNTHETIC-M1-06"), MARKER).unwrap();
            std::fs::set_permissions(
                root.join("SYNTHETIC-M1-06"),
                std::fs::Permissions::from_mode(0o600),
            )
            .unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn fixed_ids_and_private_marker_are_required_before_open() {
        let f = Fixture::new();
        assert_eq!(
            fixture_path(&f.0, "crlf").unwrap(),
            f.0.join("crlf.fountain")
        );
        for invalid in [
            "../source",
            "/tmp/source",
            "lf.fountain",
            "",
            "lf/../../source",
        ] {
            assert_eq!(
                fixture_path(&f.0, invalid).unwrap_err().code,
                ErrorCode::UnsafePath
            );
        }
        std::fs::write(f.0.join("SYNTHETIC-M1-06"), b"not synthetic").unwrap();
        assert!(fixture_path(&f.0, "lf").is_err());
        assert!(!f.0.join("app-data").exists());
    }
    #[test]
    fn symlink_marker_and_public_root_refuse_without_store_writes() {
        let f = Fixture::new();
        let marker = f.0.join("SYNTHETIC-M1-06");
        std::fs::rename(&marker, f.0.join("real-marker")).unwrap();
        std::os::unix::fs::symlink("real-marker", &marker).unwrap();
        assert!(fixture_path(&f.0, "lf").is_err());
        std::fs::remove_file(&marker).unwrap();
        std::fs::rename(f.0.join("real-marker"), &marker).unwrap();
        std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(fixture_path(&f.0, "lf").is_err());
        assert!(!f.0.join("app-data").exists());
    }
    #[test]
    fn reports_are_bounded() {
        assert!(record_composition_proof("x".repeat(32_769)).is_err());
    }
    #[test]
    fn fixed_fixture_dispatch_uses_real_writer_and_retains_external_and_recovery_bytes() {
        use screenwriter_core::documents::{
            recovery::source_hash,
            saving::{SaveReceipt, SaveRequest},
        };
        use serde_json::json;
        use tauri::test::{mock_builder, mock_context, noop_assets};
        let f = Fixture::new();
        let initial = include_bytes!("../../prototypes/editor-composition/fixtures/crlf.fountain");
        let edited =
            include_bytes!("../../prototypes/editor-composition/fixtures/crlf-edited.fountain");
        let source = f.0.join("crlf.fountain");
        std::fs::write(&source, initial).unwrap();
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o600)).unwrap();
        let service = DocumentService::new(&f.0.join("app-data")).unwrap();
        let host = DocumentHost {
            service: Arc::new(Mutex::new(Some(service))),
            ..Default::default()
        };
        let app = mock_builder()
            .manage(host.clone())
            .manage(ProofRoot(f.0.clone()))
            .invoke_handler(tauri::generate_handler![
                open_composition_fixture,
                save_document,
                release_open_document
            ])
            .build(mock_context(noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let invoke = |cmd: &str, body| {
            tauri::test::get_ipc_response(
                &webview,
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
        };
        assert!(invoke("open_composition_fixture", json!({"fixture":"../outside"})).is_err());
        let opened = invoke("open_composition_fixture", json!({"fixture":"crlf"}))
            .unwrap()
            .deserialize::<OpenDocument>()
            .unwrap();
        assert_eq!(opened.source, initial);
        let request = SaveRequest {
            identity: opened.identity.clone(),
            version: 1,
            source: edited.to_vec(),
            source_sha256: source_hash(edited),
            expected_fingerprint: opened.fingerprint.unwrap(),
            draft_metadata: json!({}),
        };
        let receipt = invoke("save_document", json!({"request":request}))
            .unwrap()
            .deserialize::<SaveReceipt>()
            .unwrap();
        assert_eq!(receipt.version, 1);
        assert_eq!(receipt.source_sha256, source_hash(edited));
        assert_eq!(std::fs::read(&source).unwrap(), edited);
        // Use an independent external byte string, never an expected value made by the writer.
        std::fs::write(&source, b"external author bytes\n").unwrap();
        let mut next = request;
        next.version = 2;
        next.expected_fingerprint = receipt.fingerprint;
        let failure = invoke("save_document", json!({"request":next})).unwrap_err();
        assert_eq!(failure["error"]["code"], "sourceChanged");
        assert_eq!(failure["replacement"], "sourceUnchanged");
        assert_eq!(failure["recovery"]["version"], 2);
        assert_eq!(std::fs::read(&source).unwrap(), b"external author bytes\n");
        let latest = host
            .service
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap();
        assert_eq!(latest.source, edited);
        invoke("release_open_document", json!({"request":opened.identity})).unwrap();
        let reopened = invoke("open_composition_fixture", json!({"fixture":"crlf"}))
            .unwrap()
            .deserialize::<OpenDocument>()
            .unwrap();
        assert_eq!(reopened.source, b"external author bytes\n");
        drop(webview);
        drop(app);
        drop(host);
    }
}
