//! Native registration/lease tests plus injected close effects. No real GTK
//! termination is claimed by these callbacks; the release drills own that proof.
use super::*;
use std::{
    cell::RefCell, fs, os::unix::fs::PermissionsExt, path::PathBuf, sync::mpsc, time::Duration,
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("BABEL_IPC_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("babel-close-{}", uuid_for_fixture()));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(
            root.join("source.fountain"),
            b"\xef\xbb\xbf!Keep this draft.  \r\n",
        )
        .unwrap();
        fs::set_permissions(
            root.join("source.fountain"),
            fs::Permissions::from_mode(0o600),
        )
        .unwrap();
        Self(root)
    }
    fn host(&self) -> DocumentHost {
        DocumentHost {
            service: Arc::new(Mutex::new(Some(
                DocumentService::new(&self.0.join("data")).unwrap(),
            ))),
            ..Default::default()
        }
    }
    fn assert_source(&self) {
        assert_eq!(
            fs::read(self.0.join("source.fountain")).unwrap(),
            b"\xef\xbb\xbf!Keep this draft.  \r\n"
        );
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn uuid_for_fixture() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}
fn failed_effect() -> tauri::Result<()> {
    Err(tauri::Error::Io(std::io::Error::other(
        "injected close failure",
    )))
}
fn close_attempt(
    host: &DocumentHost,
    notification_fails: bool,
    termination_fails: bool,
) -> Vec<&'static str> {
    let effects = RefCell::new(Vec::new());
    handle_close_request(
        host,
        || effects.borrow_mut().push("prevent"),
        || {
            effects.borrow_mut().push("notify");
            if notification_fails {
                failed_effect()
            } else {
                Ok(())
            }
        },
        || {
            effects.borrow_mut().push("terminate");
            if termination_fails {
                failed_effect()
            } else {
                Ok(())
            }
        },
    );
    effects.into_inner()
}

#[test]
fn open_registration_prevents_close_before_even_failed_notification() {
    let fixture = Fixture::new();
    let host = fixture.host();
    let opened = host
        .service
        .lock()
        .unwrap()
        .as_mut()
        .unwrap()
        .open_selected(&fixture.0.join("source.fountain"))
        .unwrap();
    assert_eq!(close_attempt(&host, true, true), ["prevent", "notify"]);
    assert_eq!(host.read(&opened.identity).unwrap().source, opened.source);
    assert!(host.has_open_documents());
    fixture.assert_source();
}

#[test]
fn closing_unsaved_registration_stays_protected_until_native_release() {
    let fixture = Fixture::new();
    let host = fixture.host();
    let opened = host
        .service
        .lock()
        .unwrap()
        .as_mut()
        .unwrap()
        .register_unsaved()
        .unwrap();
    assert_eq!(close_attempt(&host, false, false), ["prevent", "notify"]);
    // No accepted author edits in this empty synthetic draft. Release is the
    // native transition used only after the frontend protected-close receipt.
    host.release(&opened.identity).unwrap();
    assert_eq!(close_attempt(&host, false, false), ["terminate"]);
    fixture.assert_source();
}

#[test]
fn unprotected_terminate_failure_does_not_create_registration_or_write_source() {
    let fixture = Fixture::new();
    let host = fixture.host();
    assert_eq!(close_attempt(&host, false, true), ["terminate"]);
    assert!(!host.has_open_documents());
    fixture.assert_source();
    // No source/recovery receipt can be emitted by the close effect callback.
    assert!(!fixture.0.join("data/recovery").exists());
}

#[test]
fn unavailable_native_service_has_no_author_registration() {
    assert_eq!(
        close_attempt(&DocumentHost::default(), false, true),
        ["terminate"]
    );
}

#[test]
fn poisoned_document_guard_prevents_close_and_never_terminates_content() {
    let host = DocumentHost::default();
    let service = host.service.clone();
    assert!(
        std::thread::spawn(move || {
            let _guard = service.lock().unwrap();
            panic!("poison synthetic document authority");
        })
        .join()
        .is_err()
    );
    assert_eq!(close_attempt(&host, true, false), ["prevent", "notify"]);
}

#[test]
fn close_waits_for_in_flight_registration_and_observes_published_owner() {
    let fixture = Fixture::new();
    let host = fixture.host();
    let service = host.service.clone();
    let (locked_tx, locked_rx) = mpsc::channel();
    let (publish_tx, publish_rx) = mpsc::channel();
    let worker = std::thread::spawn(move || {
        let mut service = service.lock().unwrap();
        locked_tx.send(()).unwrap();
        publish_rx.recv().unwrap();
        service.as_mut().unwrap().register_unsaved().unwrap()
    });
    locked_rx.recv().unwrap();
    let closing_host = host.clone();
    let (attempt_tx, attempt_rx) = mpsc::channel();
    let close = std::thread::spawn(move || {
        attempt_tx
            .send(close_attempt(&closing_host, false, false))
            .unwrap();
    });
    assert_eq!(
        attempt_rx.recv_timeout(Duration::from_millis(30)),
        Err(mpsc::RecvTimeoutError::Timeout)
    );
    publish_tx.send(()).unwrap();
    let opened = worker.join().unwrap();
    assert_eq!(
        attempt_rx.recv_timeout(Duration::from_secs(5)).unwrap(),
        ["prevent", "notify"]
    );
    close.join().unwrap();
    assert_eq!(host.read(&opened.identity).unwrap().source, opened.source);
    fixture.assert_source();
}
