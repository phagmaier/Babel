use super::*;
use std::os::unix::fs::PermissionsExt;
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let path = std::env::var_os("BABEL_SPELLCHECK_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("babel-spellcheck-{}", uuid()));
        std::fs::create_dir(&path).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        Self(path)
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn added(word: &str) -> SpellcheckSettings {
    SpellcheckSettings {
        added: vec![AddedWord {
            language: "en_US".into(),
            word: word.into(),
        }],
        ..Default::default()
    }
}
#[test]
fn spellcheck_restart_exact_unicode_and_compare_and_publish() {
    let f = Fixture::new();
    let service = f.service();
    assert_eq!(service.read_spellcheck_settings().unwrap().generation, 0);
    assert_eq!(
        service
            .publish_spellcheck_settings(0, added("Quorvexia"))
            .unwrap(),
        1
    );
    assert_eq!(
        service
            .publish_spellcheck_settings(1, added("Zoë"))
            .unwrap(),
        2
    );
    let reopened = f.service().read_spellcheck_settings().unwrap();
    assert_eq!(reopened.settings, added("Zoë"));
    assert!(!reopened.needs_attention);
    assert!(
        service
            .publish_spellcheck_settings(1, added("lost"))
            .is_err()
    );
    assert_eq!(
        service.read_spellcheck_settings().unwrap().settings,
        added("Zoë")
    );
    // Idempotent duplicate Add delivery creates no additional generation.
    assert_eq!(
        service
            .publish_spellcheck_settings(2, added("Zoë"))
            .unwrap(),
        2
    );
    for name in SLOTS {
        assert_eq!(
            std::fs::metadata(f.0.join(name))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
}
#[test]
fn spellcheck_interruptions_keep_previous_valid_and_refuse_automatic_repair() {
    for stage in [
        Stage::PartialWrite,
        Stage::FileSynced,
        Stage::Replaced,
        Stage::DirectorySynced,
    ] {
        let f = Fixture::new();
        let service = f.service();
        service
            .publish_spellcheck_settings(0, added("Original"))
            .unwrap();
        assert!(
            service
                .publish_spellcheck_with(1, added("Candidate"), &mut |at| if at == stage {
                    Err(attention())
                } else {
                    Ok(())
                })
                .is_err()
        );
        let reopened = f.service().read_spellcheck_settings().unwrap();
        // Independent oracle: prior generation's literal word still exists.
        let prior: serde_json::Value =
            serde_json::from_slice(&std::fs::read(f.0.join("spellcheck-1.json")).unwrap()).unwrap();
        assert_eq!(prior["settings"]["added"][0]["word"], "Original");
        if matches!(stage, Stage::PartialWrite | Stage::FileSynced) {
            assert!(reopened.needs_attention);
            assert_eq!(reopened.settings, added("Original"));
            assert!(
                service
                    .publish_spellcheck_settings(reopened.generation, added("Next"))
                    .is_err()
            );
        } else {
            assert_eq!(reopened.settings, added("Candidate"));
        }
    }
}
#[test]
fn spellcheck_corruption_symlink_hardlink_and_unknown_schema_refuse() {
    for bad in [b"bad".as_slice(), b"{\"schemaVersion\":99}"] {
        let f = Fixture::new();
        let service = f.service();
        service
            .publish_spellcheck_settings(0, added("Original"))
            .unwrap();
        std::fs::write(f.0.join("spellcheck-1.json"), bad).unwrap();
        assert!(service.read_spellcheck_settings().is_err());
        assert!(
            service
                .publish_spellcheck_settings(1, added("New"))
                .is_err()
        );
        assert_eq!(std::fs::read(f.0.join("spellcheck-1.json")).unwrap(), bad);
    }
    for hard in [false, true] {
        let f = Fixture::new();
        let service = f.service();
        service
            .publish_spellcheck_settings(0, added("Original"))
            .unwrap();
        service
            .publish_spellcheck_settings(1, added("Latest"))
            .unwrap();
        let external = f.0.join("untouched");
        std::fs::write(&external, b"untouched").unwrap();
        std::fs::remove_file(f.0.join("spellcheck-0.json")).unwrap();
        if hard {
            std::fs::hard_link(&external, f.0.join("spellcheck-0.json")).unwrap();
        } else {
            std::os::unix::fs::symlink(&external, f.0.join("spellcheck-0.json")).unwrap();
        }
        let stored = service.read_spellcheck_settings().unwrap();
        assert!(stored.needs_attention);
        assert_eq!(stored.settings, added("Original"));
        assert!(
            service
                .publish_spellcheck_settings(1, added("New"))
                .is_err()
        );
        assert_eq!(std::fs::read(external).unwrap(), b"untouched");
    }
}
#[test]
fn spellcheck_write_permission_lease_and_root_replacement_refuse() {
    let f = Fixture::new();
    let service = f.service();
    service
        .publish_spellcheck_settings(0, added("Original"))
        .unwrap();
    let lease = service.lease("spellcheck").unwrap();
    assert!(service.read_spellcheck_settings().is_err());
    drop(lease);
    std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o500)).unwrap();
    assert!(
        service
            .publish_spellcheck_settings(1, added("New"))
            .is_err()
    );
    std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(
        service.read_spellcheck_settings().unwrap().settings,
        added("Original")
    );
    let moved = f.0.with_extension("moved");
    std::fs::rename(&f.0, &moved).unwrap();
    std::fs::create_dir(&f.0).unwrap();
    std::fs::set_permissions(&f.0, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert!(
        service
            .publish_spellcheck_settings(1, added("New"))
            .is_err()
    );
    assert!(
        std::fs::read(moved.join("spellcheck-1.json"))
            .unwrap()
            .windows(8)
            .any(|w| w == b"Original")
    );
    std::fs::remove_dir_all(moved).unwrap();
}
#[test]
fn spellcheck_hostile_words_languages_and_bounds() {
    for w in [
        "",
        "\nsecret",
        "../path",
        "<script>",
        "a\u{202e}b",
        "foo bar",
        "a\0b",
    ] {
        assert!(!valid_word(w));
    }
    for lang in ["", "../en", "en_US,fr_FR", "x\0z", "en US"] {
        assert!(!valid_language(lang));
    }
    assert!(!valid_word(&"a".repeat(129)));
    assert!(valid_word("Zoë"));
    assert!(valid_word("e\u{301}"));
    let mut value = added("Name");
    value.added.push(value.added[0].clone());
    assert!(!value.valid());
    value.added = (0..=MAX_ADDED_WORDS)
        .map(|i| AddedWord {
            language: "en_US".into(),
            word: format!("Word{i}"),
        })
        .collect();
    assert!(!value.valid());
}
