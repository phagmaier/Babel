use super::*;
use crate::test_support::TestRoot;
use std::{
    fs as disk,
    os::unix::fs::{PermissionsExt, symlink},
};
const OLD: &[u8] = b"%PDF-1.4\nprevious synthetic PDF\n";
const NEW: &[u8] = b"%PDF-1.4\nnew synthetic PDF\n";
struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_PDF_TEST_ROOT", "babel-pdf");
        Self(root)
    }
    fn write(&self, name: &str, bytes: &[u8]) -> PathBuf {
        self.0.write(name, bytes, 0o600)
    }
    fn service(&self) -> (DocumentService, OpenDocument, PdfCaptureReceipt) {
        let source = self.write(
            "source.fountain",
            b"\xef\xbb\xbfINT. HOUSE - DAY\r\n\r\nUnknown {{text}}  \r\n",
        );
        let mut s = DocumentService::new(&self.0.join("app-data")).unwrap();
        let o = s.open_selected(&source).unwrap();
        let c = s.prepare_pdf_capture(&self.cp(&o, 1)).unwrap();
        (s, o, c)
    }
    fn cp(&self, o: &OpenDocument, version: u64) -> CheckpointRequest {
        CheckpointRequest {
            identity: o.identity.clone(),
            version,
            source: o.source.clone(),
            source_sha256: hash(&o.source),
            expected_fingerprint: o.fingerprint.clone(),
            draft_metadata: serde_json::json!({}),
        }
    }
}
#[test]
fn new_pdf_and_replacement_keep_source_and_verified_previous() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let path = f.0.join("Draft.pdf");
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    assert!(!t.replaces_existing);
    let r = s
        .publish_pdf(&o.identity, &c.capture_token, &t.token, OLD)
        .unwrap();
    assert_eq!(r.pdf_sha256, hash(OLD));
    assert!(r.previous_file_name.is_none());
    assert!(
        s.publish_pdf(&o.identity, &c.capture_token, &t.token, NEW)
            .is_err()
    );
    let c = s.prepare_pdf_capture(&f.cp(&o, 2)).unwrap();
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    assert!(t.replaces_existing);
    let r = s
        .publish_pdf(&o.identity, &c.capture_token, &t.token, NEW)
        .unwrap();
    assert_eq!(disk::read(path).unwrap(), NEW);
    assert_eq!(
        disk::read(f.0.join(r.previous_file_name.unwrap())).unwrap(),
        OLD
    );
    assert_eq!(disk::read(f.0.join("source.fountain")).unwrap(), o.source);
}
#[test]
fn injected_failures_preserve_prior_destination_or_absence_and_spend_selection() {
    for replaces in [false, true] {
        for stage in [
            PdfStage::CandidateWritten,
            PdfStage::PreviousProtected,
            PdfStage::BeforeInstall,
            PdfStage::Installed,
            PdfStage::Synced,
            PdfStage::Verified,
        ] {
            let f = Fixture::new();
            let (mut s, o, c) = f.service();
            let path = f.0.join("Draft.pdf");
            if replaces {
                f.write("Draft.pdf", OLD);
            }
            let t = s
                .select_pdf_destination(&o.identity, &c.capture_token, &path)
                .unwrap();
            let e = s
                .publish_pdf_with(&o.identity, &c.capture_token, &t.token, NEW, &mut |at| {
                    if at == stage {
                        Err(error(ErrorCode::Io))
                    } else {
                        Ok(())
                    }
                })
                .unwrap_err();
            assert_eq!(e.code, ErrorCode::Io);
            if replaces {
                assert_eq!(disk::read(&path).unwrap(), OLD);
            } else {
                assert!(!path.exists());
            }
            assert!(
                s.publish_pdf(&o.identity, &c.capture_token, &t.token, NEW)
                    .is_err()
            );
            assert_eq!(disk::read(f.0.join("source.fountain")).unwrap(), o.source);
        }
    }
}
#[test]
fn changed_destination_before_install_is_not_overwritten() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let path = f.write("Draft.pdf", OLD);
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    let e = s
        .publish_pdf_with(&o.identity, &c.capture_token, &t.token, NEW, &mut |at| {
            if at == PdfStage::BeforeInstall {
                disk::write(&path, b"%PDF-concurrent").unwrap();
            }
            Ok(())
        })
        .unwrap_err();
    assert_eq!(e.code, ErrorCode::SourceChanged);
    assert_eq!(disk::read(path).unwrap(), b"%PDF-concurrent");
}
#[test]
fn concurrent_generation_after_install_is_retained_without_success() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let path = f.write("Draft.pdf", OLD);
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    let e = s
        .publish_pdf_with(&o.identity, &c.capture_token, &t.token, NEW, &mut |at| {
            if at == PdfStage::Installed {
                disk::write(&path, b"%PDF-concurrent").unwrap();
                return Err(error(ErrorCode::Io));
            }
            Ok(())
        })
        .unwrap_err();
    assert_eq!(e.code, ErrorCode::ExportNeedsAttention);
    assert_eq!(disk::read(path).unwrap(), b"%PDF-concurrent");
    assert!(disk::read_dir(&f.0).unwrap().any(|e| {
        e.unwrap()
            .file_name()
            .to_string_lossy()
            .ends_with(".previous.pdf")
    }));
}
#[test]
fn protected_and_unsafe_paths_are_refused() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    for p in [
        f.0.join("source.fountain"),
        f.0.join("app-data/Hidden.pdf"),
        f.0.join(".babel-danger.pdf"),
        f.0.join("notes.txt"),
    ] {
        assert!(
            s.select_pdf_destination(&o.identity, &c.capture_token, &p)
                .is_err()
        );
    }
    f.write("wrong.pdf", b"author content");
    assert!(
        s.select_pdf_destination(&o.identity, &c.capture_token, &f.0.join("wrong.pdf"))
            .is_err()
    );
    let openpdf = f.write("open.pdf", OLD);
    let _other = s.open_selected(&openpdf).unwrap();
    assert!(
        s.select_pdf_destination(&o.identity, &c.capture_token, &openpdf)
            .is_err()
    );
    symlink(f.0.join("source.fountain"), f.0.join("link.pdf")).unwrap();
    assert!(
        s.select_pdf_destination(&o.identity, &c.capture_token, &f.0.join("link.pdf"))
            .is_err()
    );
    disk::hard_link(f.0.join("wrong.pdf"), f.0.join("hard.pdf")).unwrap();
    assert!(
        s.select_pdf_destination(&o.identity, &c.capture_token, &f.0.join("hard.pdf"))
            .is_err()
    );
    disk::create_dir(f.0.join(".screenwriter")).unwrap();
    assert!(
        s.select_pdf_destination(
            &o.identity,
            &c.capture_token,
            &f.0.join(".screenwriter/history.pdf")
        )
        .is_err()
    );
}
#[test]
fn capture_survives_typing_but_cancel_and_recapture_retire_tokens() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &f.0.join("Draft.pdf"))
        .unwrap();
    let mut newer = f.cp(&o, 2);
    newer.source = b"Newer author text".to_vec();
    newer.source_sha256 = hash(&newer.source);
    s.checkpoint(
        &newer.identity,
        newer.version,
        &newer.source,
        &newer.source_sha256,
        newer.draft_metadata.clone(),
    )
    .unwrap();
    assert_eq!(
        s.pdf_capture(&o.identity, &c.capture_token).unwrap().source,
        o.source
    );
    s.cancel_pdf_capture(&o.identity, &c.capture_token).unwrap();
    assert!(
        s.publish_pdf(&o.identity, &c.capture_token, &t.token, NEW)
            .is_err()
    );
    assert!(!f.0.join("Draft.pdf").exists());
    let c = s.prepare_pdf_capture(&newer).unwrap();
    let next = s.prepare_pdf_capture(&newer).unwrap();
    assert!(s.pdf_capture(&o.identity, &c.capture_token).is_err());
    assert!(s.pdf_capture(&o.identity, &next.capture_token).is_ok());
}

#[test]
fn foreign_owner_cannot_spend_token_and_recapture_requires_fresh_selection() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let path = f.0.join("Draft.pdf");
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    let foreign = s
        .open_selected(&f.write("foreign.fountain", b"!Other draft.\n"))
        .unwrap();
    let other = s.prepare_pdf_capture(&f.cp(&foreign, 1)).unwrap();
    assert!(
        s.publish_pdf(&foreign.identity, &other.capture_token, &t.token, NEW)
            .is_err()
    );
    assert!(s.pdf_destinations.contains_key(&t.token));
    let next = s.prepare_pdf_capture(&f.cp(&o, 1)).unwrap();
    assert!(
        s.publish_pdf(&o.identity, &next.capture_token, &t.token, NEW)
            .is_err()
    );
    assert!(!path.exists());
    let t = s
        .select_pdf_destination(&o.identity, &next.capture_token, &path)
        .unwrap();
    s.publish_pdf(&o.identity, &next.capture_token, &t.token, NEW)
        .unwrap();
    assert_eq!(disk::read(path).unwrap(), NEW);
}
#[test]
fn renamed_parent_is_refused_and_anchored_previous_pdf_is_retained() {
    let f = Fixture::new();
    let (mut s, o, c) = f.service();
    let folder = f.0.join("exports");
    disk::create_dir(&folder).unwrap();
    disk::set_permissions(&folder, disk::Permissions::from_mode(0o700)).unwrap();
    let path = folder.join("Draft.pdf");
    disk::write(&path, OLD).unwrap();
    disk::set_permissions(&path, disk::Permissions::from_mode(0o600)).unwrap();
    let t = s
        .select_pdf_destination(&o.identity, &c.capture_token, &path)
        .unwrap();
    disk::rename(&folder, f.0.join("moved")).unwrap();
    disk::create_dir(&folder).unwrap();
    assert!(
        s.publish_pdf(&o.identity, &c.capture_token, &t.token, NEW)
            .is_err()
    );
    assert_eq!(disk::read(f.0.join("moved/Draft.pdf")).unwrap(), OLD);
    assert!(!path.exists());
}
