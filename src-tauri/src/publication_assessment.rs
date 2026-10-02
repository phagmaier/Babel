//! Read-only identity and in-memory layout assessment. No caller-chosen paths.
use super::*;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssessmentRequest {
    sources: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentResult {
    identity: serde_json::Value,
    layout: Vec<Option<String>>,
}
fn assessment_identity(runtime: &Path) -> Result<serde_json::Value, PublicationError> {
    if !runtime_ready(runtime) {
        return Err(PublicationError::RendererUnavailable);
    }
    let mut coverage: serde_json::Value =
        serde_json::from_str(include_str!("../../src/domain/publicationCoverage.json"))
            .map_err(|_| PublicationError::Internal)?;
    let profile = fs::read(runtime.join("app/profiles/us-letter-draft-v1.json"))
        .map_err(|_| PublicationError::RendererUnavailable)?;
    if source_hash(&profile) != coverage["profileSha256"].as_str().unwrap_or("") {
        return Err(PublicationError::RendererUnavailable);
    }
    for (relative, expected) in [
        (
            "app/babel_pdf_helper.py",
            include_bytes!("../../tools/pdf-helper/babel_pdf_helper.py").as_slice(),
        ),
        (
            "app/frozen_profile.py",
            include_bytes!("../../tools/pdf-helper/frozen_profile.py").as_slice(),
        ),
        (
            "app/pins.json",
            include_bytes!("../../tools/pdf-helper/pins.json").as_slice(),
        ),
    ] {
        if fs::read(runtime.join(relative)).map_err(|_| PublicationError::RendererUnavailable)?
            != expected
        {
            return Err(PublicationError::RendererUnavailable);
        }
    }
    let profile_value: serde_json::Value =
        serde_json::from_slice(&profile).map_err(|_| PublicationError::RendererUnavailable)?;
    for (relative, expected) in profile_value["upstreamSha256"]
        .as_object()
        .ok_or(PublicationError::RendererUnavailable)?
    {
        let bytes = fs::read(runtime.join("app/lib").join(relative))
            .map_err(|_| PublicationError::RendererUnavailable)?;
        if Some(source_hash(&bytes).as_str()) != expected.as_str() {
            return Err(PublicationError::RendererUnavailable);
        }
    }
    for font in coverage["fonts"]
        .as_array_mut()
        .ok_or(PublicationError::Internal)?
    {
        let file = font["file"].as_str().ok_or(PublicationError::Internal)?;
        let data = fs::read(
            runtime
                .join("app/lib/screenplain/export/courier_prime")
                .join(file),
        )
        .map_err(|_| PublicationError::FontIntegrity)?;
        if source_hash(&data) != font["sha256"].as_str().unwrap_or("") {
            return Err(PublicationError::FontIntegrity);
        }
        font.as_object_mut().unwrap().remove("ranges");
    }
    Ok(coverage)
}
fn assess_runtime(
    runtime: &Path,
    request: AssessmentRequest,
) -> Result<AssessmentResult, PublicationError> {
    let identity = assessment_identity(runtime)?;
    if request.sources.len() > 1000 {
        return Err(PublicationError::InvalidRequest);
    }
    let expected = request.sources.len();
    let data =
        serde_json::to_vec(&request.sources).map_err(|_| PublicationError::InvalidRequest)?;
    if data.len() > MAX_SOURCE_BYTES {
        return Err(PublicationError::SourceTooLarge);
    }
    if expected == 0 {
        return Ok(AssessmentResult {
            identity,
            layout: vec![],
        });
    }
    let mut command = Command::new(runtime.join("python/bin/python3.13"));
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .args(["-I", "-S", "-B", "-c", include_str!("assessment_probe.py")])
        .arg(runtime.join("app"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| PublicationError::RendererUnavailable)?;
    let mut stdin = child.stdin.take().unwrap();
    let writer = std::thread::spawn(move || stdin.write_all(&data));
    let stdout = child.stdout.take().unwrap();
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take(MAX_STDOUT + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let start = Instant::now();
    let status = loop {
        if start.elapsed() > Duration::from_secs(70) {
            kill_helper(&mut child);
            let _ = child.wait();
            let _ = writer.join();
            let _ = reader.join();
            return Err(PublicationError::Timeout);
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(_) => {
                kill_helper(&mut child);
                let _ = child.wait();
                let _ = writer.join();
                let _ = reader.join();
                return Err(PublicationError::Internal);
            }
        }
    };
    writer
        .join()
        .map_err(|_| PublicationError::Internal)?
        .map_err(|_| PublicationError::Internal)?;
    let output = reader
        .join()
        .map_err(|_| PublicationError::Internal)?
        .map_err(|_| PublicationError::Internal)?;
    if !status.success() || output.len() as u64 > MAX_STDOUT {
        return Err(PublicationError::RendererUnavailable);
    }
    let layout: Vec<Option<String>> =
        serde_json::from_slice(&output).map_err(|_| PublicationError::InvalidResponse)?;
    if layout.len() != expected
        || layout.iter().flatten().any(|feature| {
            !matches!(
                feature.as_str(),
                "dual-dialogue-overflow"
                    | "cue-exceeds-page"
                    | "parenthetical-exceeds-page"
                    | "unpaired-dual-dialogue"
                    | "scene-number-width"
                    | "glyph-coverage-or-shaping"
            )
        })
    {
        return Err(PublicationError::InvalidResponse);
    }
    Ok(AssessmentResult { identity, layout })
}
#[tauri::command]
pub async fn assess_publication(
    request: AssessmentRequest,
    documents: tauri::State<'_, DocumentHost>,
    state: tauri::State<'_, PublicationHost>,
) -> Result<AssessmentResult, PublicationError> {
    let bytes = request
        .sources
        .iter()
        .try_fold(0usize, |sum, source| sum.checked_add(source.len()))
        .ok_or(PublicationError::SourceTooLarge)?;
    if bytes > MAX_SOURCE_BYTES || request.sources.len() > 1000 {
        return Err(PublicationError::SourceTooLarge);
    }
    let permit = documents
        .reserve(bytes)
        .map_err(|_| PublicationError::QueueFull)?;
    let runtime = state.get()?.runtime.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        assess_runtime(&runtime, request)
    })
    .await
    .map_err(|_| PublicationError::Internal)?
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    fn runtime() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../target/pdf-helper/runtime")
    }
    #[test]
    fn assessment_real_layout_positive_and_negative_no_publication_files() {
        let runtime = runtime();
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
        let sources = [
            fs::read_to_string(repo.join("fixtures/publication/dual-first.fountain")).unwrap(),
            fs::read_to_string(repo.join("fixtures/publication/dual-overflow.fountain")).unwrap(),
            "@ALICE\nCafé Zoë Ångström — € ©.\n".into(),
            format!("@{}\nHello.\n", "ALICE ".repeat(1000)),
            format!("@ALICE\n({})\nHello.\n", "slowly ".repeat(1000)),
            format!(".INT. A - DAY #{}#\n\n!Action.\n", "1".repeat(20)),
        ];
        let result = assess_runtime(
            &runtime,
            AssessmentRequest {
                sources: sources.to_vec(),
            },
        )
        .unwrap();
        assert_eq!(
            result.layout,
            vec![
                None,
                Some("dual-dialogue-overflow".into()),
                None,
                Some("cue-exceeds-page".into()),
                Some("parenthetical-exceeds-page".into()),
                Some("scene-number-width".into())
            ]
        );
        assert_eq!(result.identity["profile"], PROFILE);
        assert_eq!(result.identity["fonts"].as_array().unwrap().len(), 4);
        // Output is a typed feature inventory, no PDF/path/count is returned.
        assert!(
            serde_json::to_value(result)
                .unwrap()
                .get("pageCount")
                .is_none()
        );
    }
    #[test]
    fn assessment_identity_rejects_missing_changed_profile_font_and_upstream() {
        let base = std::env::var_os("BABEL_PUBLICATION_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!(
            "babel-assessment-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        assert!(assessment_identity(&root).is_err());
        let real = runtime();
        let mut files = vec![
            "BUILD.json".to_owned(),
            "app/babel_pdf_helper.py".into(),
            "app/frozen_profile.py".into(),
            "app/pins.json".into(),
            "app/profiles/us-letter-draft-v1.json".into(),
        ];
        let profile: serde_json::Value = serde_json::from_str(include_str!(
            "../../tools/pdf-helper/profiles/us-letter-draft-v1.json"
        ))
        .unwrap();
        files.extend(
            profile["upstreamSha256"]
                .as_object()
                .unwrap()
                .keys()
                .map(|path| format!("app/lib/{path}")),
        );
        let pins: serde_json::Value =
            serde_json::from_str(include_str!("../../tools/pdf-helper/pins.json")).unwrap();
        files.extend(
            pins["fonts"]
                .as_object()
                .unwrap()
                .keys()
                .map(|path| format!("app/lib/{path}")),
        );
        for file in &files {
            let dest = root.join(file);
            fs::create_dir_all(dest.parent().unwrap()).unwrap();
            fs::copy(real.join(file), dest).unwrap();
        }
        fs::create_dir_all(root.join("python/bin")).unwrap();
        std::os::unix::fs::symlink(
            real.join("python/bin/python3.13").canonicalize().unwrap(),
            root.join("python/bin/python3.13"),
        )
        .unwrap();
        assert!(assessment_identity(&root).is_ok());
        for file in [
            "app/profiles/us-letter-draft-v1.json",
            "app/lib/screenplain/export/courier_prime/Courier Prime.ttf",
            "app/lib/screenplain/export/pdf.py",
            "app/frozen_profile.py",
        ] {
            fs::write(root.join(file), b"changed").unwrap();
            assert!(
                assessment_identity(&root).is_err(),
                "accepted changed {file}"
            );
            fs::copy(real.join(file), root.join(file)).unwrap();
        }
        assert!(assessment_identity(&root).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
