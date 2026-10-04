//! First-run app-dir restriction tests on real Linux files.
use super::*;
use crate::test_support::TestRoot;
use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};

struct Fixture(TestRoot);
impl Fixture {
    fn dir(mode: u32) -> Self {
        let root = TestRoot::with_options(
            "BABEL_APP_DIR_TEST_ROOT",
            "babel-app-dir",
            Some(mode),
            false,
        );
        Self(root)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = self.0.cleanup();
    }
}

fn mode(path: &Path) -> u32 {
    fs::metadata(path).unwrap().permissions().mode() & 0o7777
}

#[test]
fn fresh_tauri_default_is_restricted_without_touching_contents() {
    let fixture = Fixture::dir(0o755);
    fs::write(fixture.0.join("keep"), b"untouched").unwrap();
    ensure_private_app_dir(&fixture.0).unwrap();
    assert_eq!(mode(&fixture.0), 0o700);
    assert_eq!(fs::read(fixture.0.join("keep")).unwrap(), b"untouched");
    // Idempotent: an already private root is left alone.
    ensure_private_app_dir(&fixture.0).unwrap();
    assert_eq!(mode(&fixture.0), 0o700);
}

#[test]
fn group_only_bits_are_removed_never_added() {
    let fixture = Fixture::dir(0o750);
    ensure_private_app_dir(&fixture.0).unwrap();
    assert_eq!(mode(&fixture.0), 0o700);
}

#[test]
fn symlinks_files_and_relative_paths_refuse() {
    let fixture = Fixture::dir(0o700);
    std::os::unix::fs::symlink(&fixture.0, fixture.0.join("link")).unwrap();
    assert!(ensure_private_app_dir(&fixture.0.join("link")).is_err());
    let file = fixture.0.join("plain");
    fs::write(&file, b"x").unwrap();
    assert!(ensure_private_app_dir(&file).is_err());
    assert!(ensure_private_app_dir(Path::new("relative/app")).is_err());
}

#[test]
fn missing_roots_report_missing_not_refusal() {
    let missing = std::env::var_os("BABEL_APP_DIR_TEST_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(format!(
            "babel-app-dir-absent-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
    let err = ensure_private_app_dir(&missing).unwrap_err();
    assert_eq!(err.code, ErrorCode::MissingSource);
}
