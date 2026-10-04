//! Fake-helper faults and real-helper filesystem tests; no WebView claims.
use super::*;
use crate::test_support::TestRoot;
use std::os::unix::fs::{PermissionsExt, symlink};
struct Fixture {
    root: TestRoot,
    host: PublicationHost,
}
impl Fixture {
    fn new(script: Option<&str>, timeout: Duration) -> Self {
        let root = TestRoot::with_options(
            "BABEL_PUBLICATION_TEST_ROOT",
            "babel-publication",
            None,
            true,
        );
        let real = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../target/pdf-helper/runtime")
            .canonicalize()
            .unwrap();
        let runtime = if let Some(script) = script {
            let runtime = root.join("runtime");
            fs::create_dir_all(runtime.join("python/bin")).unwrap();
            fs::create_dir(runtime.join("app")).unwrap();
            // The pinned interpreter executes an injected protocol script; no system Python.
            symlink(
                real.join("python/bin/python3.13"),
                runtime.join("python/bin/python3.13"),
            )
            .unwrap();
            fs::write(runtime.join("app/babel_pdf_helper.py"), script).unwrap();
            fs::write(
                runtime.join("BUILD.json"),
                serde_json::json!({"protocol":1,"treeSha256":TREE}).to_string(),
            )
            .unwrap();
            runtime
        } else {
            real
        };
        let host = PublicationHost::default();
        host.initialize(runtime, root.join("cache")).unwrap();
        let mut inner = host.inner.lock().unwrap();
        Arc::get_mut(inner.as_mut().unwrap()).unwrap().timeout = timeout;
        drop(inner);
        Self { root, host }
    }
    fn request(&self, id: u64, version: u64) -> RenderRequest {
        let source = b"Title: Synthetic\r\n\r\nINT. ROOM - DAY\r\n\r\nA lamp glows.\r\n".to_vec();
        RenderRequest {
            identity: DocumentRequest {
                handle: "owned-handle".into(),
                document_id: "doc".into(),
                session_id: "session".into(),
            },
            request_id: id,
            version,
            source_sha256: source_hash(&source),
            source,
            profile: PROFILE.into(),
            font_set: FONT_SET.into(),
            options: RenderOptions {},
        }
    }
    fn run(&self, r: RenderRequest) -> Result<RenderResult, PublicationError> {
        self.host
            .submit(r)?
            .recv_timeout(Duration::from_secs(10))
            .unwrap()
    }
    fn empty(&self) -> bool {
        fs::read_dir(self.root.join("cache"))
            .unwrap()
            .filter(|e| {
                e.as_ref()
                    .unwrap()
                    .path()
                    .extension()
                    .is_some_and(|x| x == "pdf")
            })
            .count()
            == 0
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = self.host.cancel(None, true);
        let until = Instant::now() + Duration::from_secs(3);
        while self
            .host
            .get()
            .is_ok_and(|i| i.queue.lock().unwrap().running)
            && Instant::now() < until
        {
            std::thread::sleep(Duration::from_millis(10));
        }
        self.root.cleanup().unwrap();
    }
}
#[test]
fn publication_timeout_bounds_blocked_stdin_and_inherited_pipes() {
    let f = Fixture::new(
        Some(
            "import subprocess,time\nsubprocess.Popen([__import__('sys').executable,'-c','import time; time.sleep(100)'])\ntime.sleep(100)",
        ),
        Duration::from_millis(100),
    );
    let mut r = f.request(1, 1);
    r.source = vec![b'a'; MAX_SOURCE_BYTES];
    r.source_sha256 = source_hash(&r.source);
    let start = Instant::now();
    assert_eq!(f.run(r).unwrap_err(), PublicationError::Timeout);
    assert!(start.elapsed() < Duration::from_secs(3));
    assert!(f.empty());
}
#[test]
fn publication_crash_kill_errors_and_stdout_cap() {
    for (script, error) in [
        (
            // PR_SET_DUMPABLE=0 applies only to this synthetic crashing child.
            // Keep the real SIGABRT failure without a core or desktop alert.
            "import os,signal,ctypes\nassert ctypes.CDLL(None).prctl(4,0,0,0,0)==0\nos.kill(os.getpid(),signal.SIGABRT)",
            PublicationError::HelperCrashed,
        ),
        (
            "import os,signal\nos.kill(os.getpid(),signal.SIGKILL)",
            PublicationError::HelperKilled,
        ),
        ("print('x'*100000)", PublicationError::InvalidResponse),
        ("print('{}')", PublicationError::InvalidResponse),
    ] {
        let f = Fixture::new(Some(script), Duration::from_secs(3));
        assert_eq!(f.run(f.request(1, 1)).unwrap_err(), error);
        assert!(f.empty());
    }
    for code in [
        "bad-request",
        "unsupported-protocol",
        "unsupported-profile",
        "output-invalid",
        "output-exists",
        "source-too-large",
        "invalid-utf8",
        "font-integrity",
        "render-failed",
        "internal",
        "unknown",
    ] {
        let script = format!(
            "import json,sys\nprint(json.dumps({{'protocol':1,'ok':False,'error':{{'code':'{code}'}}}}))\nsys.exit(2)"
        );
        let f = Fixture::new(Some(&script), Duration::from_secs(3));
        assert_eq!(f.run(f.request(1, 1)).unwrap_err(), helper_error(code));
        assert!(f.empty());
    }
}
#[test]
fn publication_supersede_cancel_and_stale_version() {
    let f = Fixture::new(Some("import time\ntime.sleep(100)"), Duration::from_secs(3));
    let first = f.host.submit(f.request(1, 2)).unwrap();
    // Wait for the active helper, so this exercises process cancellation as well as pending replacement.
    while f
        .host
        .get()
        .unwrap()
        .queue
        .lock()
        .unwrap()
        .current
        .is_none()
    {
        std::thread::sleep(Duration::from_millis(1));
    }
    let second = f.host.submit(f.request(2, 3)).unwrap();
    let third = f.host.submit(f.request(3, 4)).unwrap();
    assert_eq!(
        first
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap_err(),
        PublicationError::Cancelled
    );
    assert_eq!(
        second
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap_err(),
        PublicationError::Cancelled
    );
    assert_eq!(
        f.host.submit(f.request(4, 3)).unwrap_err(),
        PublicationError::StaleVersion
    );
    let mut mismatched = f.request(4, 4);
    mismatched.source.push(b'!');
    mismatched.source_sha256 = source_hash(&mismatched.source);
    assert_eq!(
        f.host.submit(mismatched).unwrap_err(),
        PublicationError::StaleVersion
    );
    f.host
        .cancel(
            Some(&CancelRequest {
                identity: f.request(1, 1).identity,
                request_id: 3,
            }),
            false,
        )
        .unwrap();
    assert_eq!(
        third
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap_err(),
        PublicationError::Cancelled
    );
    assert!(f.empty());
}
#[test]
fn publication_empty_resource_and_nonexecutable_are_unavailable() {
    let f = Fixture::new(Some("pass"), Duration::from_secs(3));
    let runtime = f.host.get().unwrap().runtime.clone();
    fs::remove_file(runtime.join("BUILD.json")).unwrap();
    assert_eq!(
        f.run(f.request(1, 1)).unwrap_err(),
        PublicationError::RendererUnavailable
    );
    fs::write(
        runtime.join("BUILD.json"),
        serde_json::json!({"protocol":1,"treeSha256":TREE}).to_string(),
    )
    .unwrap();
    fs::remove_file(runtime.join("python/bin/python3.13")).unwrap();
    fs::write(runtime.join("python/bin/python3.13"), "fake").unwrap();
    fs::set_permissions(
        runtime.join("python/bin/python3.13"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    assert_eq!(
        f.run(f.request(2, 2)).unwrap_err(),
        PublicationError::RendererUnavailable
    );
    assert!(f.empty());
}
#[test]
fn publication_real_helper_exact_result_cache_supersede_close() {
    let f = Fixture::new(None, Duration::from_secs(10));
    let r = f.request(1, 1);
    let expected = r.source.clone();
    let result = f.run(r.clone()).unwrap();
    assert_eq!(result.source_sha256, source_hash(&expected));
    assert_eq!(result.version, 1);
    assert_eq!(result.page_count, 2);
    assert!(result.profile_frozen);
    assert_eq!(result.source_map, "unsupported");
    assert_eq!(
        fs::read_dir(f.root.join("cache"))
            .unwrap()
            .filter(|e| e
                .as_ref()
                .unwrap()
                .path()
                .extension()
                .is_some_and(|x| x == "pdf"))
            .count(),
        1
    );
    let old = f
        .root
        .join("cache")
        .join(format!("{}.pdf", result.artifact));
    let next = f.run(f.request(2, 2)).unwrap();
    assert!(!old.exists());
    assert_ne!(next.artifact, result.artifact);
    // An old cancel must not remove the newer artifact.
    f.host
        .cancel(
            Some(&CancelRequest {
                identity: r.identity.clone(),
                request_id: 1,
            }),
            false,
        )
        .unwrap();
    assert!(!f.empty());
    f.host
        .cancel(
            Some(&CancelRequest {
                identity: r.identity,
                request_id: 2,
            }),
            true,
        )
        .unwrap();
    assert!(f.empty());
}
#[test]
fn publication_rejects_bad_capture_and_false_helper_identity() {
    let f = Fixture::new(None, Duration::from_secs(10));
    let mut r = f.request(1, 1);
    r.source_sha256 = "0".repeat(64);
    assert_eq!(f.run(r).unwrap_err(), PublicationError::InvalidRequest);
    let mut r = f.request(1, 1);
    r.source = vec![255];
    assert_eq!(f.run(r).unwrap_err(), PublicationError::InvalidUtf8);
    // Copy real helper output and falsify its exact source binding independently.
    let r = f.request(1, 1);
    let result = f.run(r.clone()).unwrap();
    let response = serde_json::json!({"protocol":1,"ok":true,"pageCount":1,"sourceSha256":"0".repeat(64),"sourceBytes":r.source.len(),"profile":PROFILE,"profileFrozen":true,"renderer":result.renderer,"fonts":result.fonts,"sourceMap":"unsupported","warnings":[]});
    let script = format!(
        "import json,sys\nr=json.loads(sys.argv[1])\nopen(r['output'],'wb').write(b'%PDF-fake')\nprint({:?})",
        response.to_string()
    );
    let fake = Fixture::new(Some(&script), Duration::from_secs(3));
    assert_eq!(
        fake.run(fake.request(1, 1)).unwrap_err(),
        PublicationError::InvalidResponse
    );
    assert!(fake.empty());
}

#[test]
fn publication_cache_lease_restart_cleanup_and_private_modes() {
    let f = Fixture::new(None, Duration::from_secs(10));
    let inner = f.host.get().unwrap();
    let second = PublicationHost::default();
    assert_eq!(
        second
            .initialize(inner.runtime.clone(), inner.cache.clone())
            .unwrap_err(),
        PublicationError::CacheUnavailable
    );
    let result = f.run(f.request(1, 1)).unwrap();
    let pdf = inner.cache.join(format!("{}.pdf", result.artifact));
    assert_eq!(
        fs::metadata(&inner.cache).unwrap().permissions().mode() & 0o777,
        0o700
    );
    assert_eq!(
        fs::metadata(&pdf).unwrap().permissions().mode() & 0o777,
        0o600
    );
    // Simulate an abandoned artifact after dropping the lease, then initialize fresh.
    let runtime = inner.runtime.clone();
    let cache = inner.cache.clone();
    drop(inner);
    f.host.cancel(None, true).unwrap();
    let until = Instant::now() + Duration::from_secs(3);
    while Arc::strong_count(&f.host.get().unwrap()) > 2 && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(1));
    }
    *f.host.inner.lock().unwrap() = None;
    fs::write(cache.join("render-abandoned.pdf"), b"%PDF-abandoned").unwrap();
    second.initialize(runtime, cache).unwrap();
    assert!(f.empty());
    // Restore host ownership for fixture teardown.
    *f.host.inner.lock().unwrap() = second.inner.lock().unwrap().take();
}

#[test]
fn preview_reads_only_current_owned_bounded_regular_artifact() {
    let f = Fixture::new(None, Duration::from_secs(10));
    let result = f.run(f.request(1, 1)).unwrap();
    let request = ReadPublicationRequest {
        identity: result.identity.clone(),
        request_id: result.request_id,
        artifact: result.artifact.clone(),
    };
    let bytes = f.host.read(&request).unwrap();
    assert!(bytes.starts_with(b"%PDF-"));
    for wrong in [
        ReadPublicationRequest {
            artifact: "../../outside".into(),
            ..request.clone()
        },
        ReadPublicationRequest {
            request_id: 2,
            ..request.clone()
        },
        ReadPublicationRequest {
            identity: DocumentRequest {
                session_id: "foreign".into(),
                ..request.identity.clone()
            },
            ..request.clone()
        },
    ] {
        assert_eq!(
            f.host.read(&wrong).unwrap_err(),
            PublicationError::InvalidRequest
        );
    }
    let second = f.run(f.request(2, 2)).unwrap();
    assert_eq!(
        f.host.read(&request).unwrap_err(),
        PublicationError::InvalidRequest
    );
    let current = ReadPublicationRequest {
        request_id: 2,
        artifact: second.artifact.clone(),
        ..request
    };
    let path = f
        .root
        .join("cache")
        .join(format!("{}.pdf", second.artifact));
    fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_len(32 * 1024 * 1024 + 1)
        .unwrap();
    assert_eq!(
        f.host.read(&current).unwrap_err(),
        PublicationError::OutputInvalid
    );
    fs::write(&path, b"bad").unwrap();
    assert_eq!(
        f.host.read(&current).unwrap_err(),
        PublicationError::OutputInvalid
    );
    fs::remove_file(&path).unwrap();
    let outside = f.root.join("outside.pdf");
    fs::write(&outside, &bytes).unwrap();
    symlink(&outside, &path).unwrap();
    assert_eq!(
        f.host.read(&current).unwrap_err(),
        PublicationError::CacheUnavailable
    );
    fs::remove_file(&path).unwrap();
    fs::write(&path, &bytes).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    let link = f.root.join("linked.pdf");
    fs::hard_link(&path, &link).unwrap();
    assert_eq!(
        f.host.read(&current).unwrap_err(),
        PublicationError::OutputInvalid
    );
    fs::remove_file(link).unwrap();
    f.host.cancel(None, true).unwrap();
    assert_eq!(
        f.host.read(&current).unwrap_err(),
        PublicationError::Cancelled
    );
}
