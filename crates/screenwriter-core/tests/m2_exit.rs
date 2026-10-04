#![cfg(target_os = "linux")]
//! One disposable open/save/restart/acknowledged-checkpoint/adoption drill.
mod common;
use common::TestRoot;
use screenwriter_core::documents::{
    DocumentService,
    choices::RecoverRequest,
    recovery::source_hash,
    saving::{SaveProtection, SaveRequest},
    startup::{RecoveryOrigin, RecoverySelection},
};
use std::{fs, path::PathBuf};

const INITIAL: &[u8] = b"\xef\xbb\xbfTitle: Exit\r\n\r\nINT. ROOM - DAY\r\n  first  \r\n";
const SAVED: &[u8] = b"\xef\xbb\xbfTitle: Exit\r\n\r\nINT. ROOM - DAY\r\n  saved [[raw]]  \r\n";
const JOURNALED: &[u8] =
    b"\xef\xbb\xbfTitle: Exit\r\n\r\nINT. ROOM - DAY\r\n  journaled [[raw]]  \r\n";

struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_M2_EXIT_TEST_ROOT", "babel-m2-exit");
        root.write("script.fountain", INITIAL, 0o640);
        Self(root)
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }
    fn source(&self) -> PathBuf {
        self.0.join("script.fountain")
    }
}

#[test]
fn m2_native_open_save_reopen_and_acknowledged_checkpoint_recovery() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source()).unwrap();
    assert_eq!(opened.source, INITIAL);
    let id = &opened.identity;
    let saved = service
        .save_request(SaveRequest {
            identity: id.clone(),
            version: 1,
            source: SAVED.to_vec(),
            source_sha256: source_hash(SAVED),
            expected_fingerprint: opened.fingerprint.unwrap(),
            draft_metadata: serde_json::Value::Null,
        })
        .unwrap();
    assert_eq!(saved.protection, SaveProtection::SourceFile);
    assert_eq!(fs::read(fixture.source()).unwrap(), SAVED);
    let journal = service
        .checkpoint(
            id,
            2,
            JOURNALED,
            &source_hash(JOURNALED),
            serde_json::Value::Null,
        )
        .unwrap();
    assert_eq!(journal.version, 2);
    assert_eq!(fs::read(fixture.source()).unwrap(), SAVED);
    drop(service);

    let mut restarted = fixture.service();
    let reopened = restarted.open_selected(&fixture.source()).unwrap();
    assert_eq!(reopened.identity.document_id, id.document_id);
    let latest = restarted
        .inspect_recovery(&reopened.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(latest.source, JOURNALED);
    assert_eq!(latest.metadata.source_sha256, source_hash(JOURNALED));
    let selection = RecoverySelection {
        document_id: reopened.identity.document_id.clone(),
        origin: RecoveryOrigin::Current,
        record_sha256: source_hash(&latest.encode().unwrap()),
    };
    let adopted = restarted
        .recover_checkpoint_as_current(&RecoverRequest {
            replacement_metadata: None,
            identity: reopened.identity.clone(),
            selection,
            new_version: 3,
            expected_fingerprint: reopened.fingerprint.unwrap(),
        })
        .unwrap();
    assert_eq!(adopted.version, 3);
    assert_eq!(adopted.source_sha256, source_hash(JOURNALED));
    assert_eq!(fs::read(fixture.source()).unwrap(), JOURNALED);
    assert_eq!(
        restarted
            .inspect_source_save(&reopened.identity)
            .unwrap()
            .previous
            .unwrap(),
        SAVED
    );
    assert_eq!(
        restarted.history_health(&reopened.identity).unwrap(),
        screenwriter_core::documents::history::HistoryHealth::Ready
    );
}
