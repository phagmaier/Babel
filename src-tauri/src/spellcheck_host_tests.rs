use super::*;
use crate::test_support::TestRoot;
use std::os::unix::fs::PermissionsExt;
struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let path = TestRoot::new("BABEL_SPELLCHECK_TEST_ROOT", "babel-spellcheck-host");
        Self(path)
    }
    fn host(&self) -> SpellcheckHost {
        SpellcheckHost {
            service: Arc::new(Mutex::new(Some(DocumentService::new(&self.0).unwrap()))),
            ..Default::default()
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = self.0.cleanup();
    }
}
fn request(value: serde_json::Value) -> SpellcheckRequest {
    serde_json::from_value(value).unwrap()
}
#[test]
fn spellcheck_actual_offline_backend_scope_add_ignore_restart_and_missing_language() {
    let f = Fixture::new();
    let host = f.host();
    let status = host
        .perform(request(serde_json::json!({"action":"status"})))
        .unwrap();
    assert!(status.available);
    assert!(status.resource.contains("Hunspell"));
    assert!(status.languages.contains(&"en_US".into()));
    let suggest = host
        .perform(request(
            serde_json::json!({"action":"suggest","language":"en_US","words":["helllo"]}),
        ))
        .unwrap();
    assert_eq!(suggest.correct, [false]);
    assert!(suggest.suggestions.contains(&"hello".into()));
    host.perform(request(
        serde_json::json!({"action":"ignore","language":"en_US","words":["Quorvexia"]}),
    ))
    .unwrap();
    let check = || {
        request(
            serde_json::json!({"action":"check","language":"en_US","words":["Quorvexia","QUORVEXIA","Zøëvexia"]}),
        )
    };
    assert_eq!(host.perform(check()).unwrap().correct, [true, true, false]);
    assert_eq!(
        f.host().perform(check()).unwrap().correct,
        [false, false, false]
    );
    host.perform(request(
        serde_json::json!({"action":"add","language":"en_US","words":["Zøëvexia"]}),
    ))
    .unwrap();
    assert_eq!(
        f.host().perform(check()).unwrap().correct,
        [false, false, true]
    );
    let fresh = Fixture::new();
    assert_eq!(
        fresh.host().perform(check()).unwrap().correct,
        [false, false, false]
    );
    host.perform(request(
        serde_json::json!({"action":"configure","language":"zz_ZZ","enabled":true}),
    ))
    .unwrap();
    let status = host
        .perform(request(serde_json::json!({"action":"status"})))
        .unwrap();
    assert!(!status.available);
    assert!(
        host.perform(request(
            serde_json::json!({"action":"suggest","language":"zz_ZZ","words":["helllo"]})
        ))
        .is_err()
    );
    assert!(host.perform(check()).is_err());
}
#[test]
fn spellcheck_write_failure_preserves_dictionary_and_session_status() {
    let f = Fixture::new();
    let host = f.host();
    host.perform(request(
        serde_json::json!({"action":"add","language":"en_US","words":["Originalvexia"]}),
    ))
    .unwrap();
    std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o500)).unwrap();
    assert!(
        host.perform(request(
            serde_json::json!({"action":"add","language":"en_US","words":["Candidatevexia"]})
        ))
        .is_err()
    );
    std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(f.host().perform(request(serde_json::json!({"action":"check","language":"en_US","words":["Originalvexia","Candidatevexia"]}))).unwrap().correct,[true,false]);
    host.perform(request(
        serde_json::json!({"action":"configure","language":"en_US","enabled":false}),
    ))
    .unwrap();
    assert!(
        host.perform(request(
            serde_json::json!({"action":"check","language":"en_US","words":["helllo"]})
        ))
        .is_err()
    );
}
#[test]
fn spellcheck_ipc_envelope_rejects_paths_unknown_fields_and_overloads() {
    assert!(
        serde_json::from_value::<SpellcheckRequest>(
            serde_json::json!({"action":"add","path":"/tmp/foo"})
        )
        .is_err()
    );
    for value in [
        serde_json::json!({"action":"add","language":"en_US","words":["../bad"]}),
        serde_json::json!({"action":"check","language":"en_US","words":vec!["hello";129]}),
        serde_json::json!({"action":"status","enabled":true}),
        serde_json::json!({"action":"configure","language":"en_US,fr_FR","enabled":true}),
    ] {
        assert!(
            serde_json::from_value::<SpellcheckRequest>(value)
                .map_or(true, |request| !request.valid())
        );
    }
    let host = SpellcheckHost::default();
    assert!(
        host.perform(request(serde_json::json!({"action":"status"})))
            .is_err()
    );
    host.pending.store(2, Ordering::SeqCst);
    assert!(
        host.pending
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| (n < 2)
                .then_some(n + 1))
            .is_err()
    );
    assert_eq!(host.pending.load(Ordering::SeqCst), 2);
}
