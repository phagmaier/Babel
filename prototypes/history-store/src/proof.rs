//! Linux-only disposable fixture owner, shared by tests and the bundle probe.
use crate::{
    NEW, OLD, PROFILE, PROJECT, advance, fetch_local, init, push_local, read, record, restore,
};
use git2::{ConfigLevel, Repository};
use std::fs::{self, File};
use std::io::{self, Read};
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

fn private_dir(root: &Path) -> io::Result<PathBuf> {
    let mut nonce = [0; 16];
    File::open("/dev/urandom")?.read_exact(&mut nonce)?;
    let name: String = nonce.iter().map(|byte| format!("{byte:02x}")).collect();
    let dir = root.join(format!("babel-history-{name}"));
    fs::DirBuilder::new().mode(0o700).create(&dir)?;
    Ok(dir)
}

static CONFIG: OnceLock<PathBuf> = OnceLock::new();

pub struct Sandbox(pub PathBuf);
impl Sandbox {
    pub fn new() -> io::Result<Self> {
        CONFIG.get_or_init(|| {
            let directory = private_dir(&std::env::temp_dir()).expect("private config directory");
            // SAFETY: every proof Git call happens AFTER this OnceLock returns;
            // search paths initialize once before any concurrent Git use.
            // These are process-local libgit2 settings, not user configuration.
            for level in [
                ConfigLevel::System,
                ConfigLevel::Global,
                ConfigLevel::XDG,
                ConfigLevel::ProgramData,
            ] {
                unsafe {
                    git2::opts::set_search_path(level, &directory)
                        .expect("isolated config search path");
                }
            }
            directory
        });
        let root = std::env::var_os("BABEL_HISTORY_PROOF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        Ok(Self(private_dir(&root)?))
    }
    pub fn repo(&self, name: &str) -> Repository {
        init(&self.0.join(name)).unwrap()
    }
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub fn smoke() -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = Sandbox::new()?;
    let a = sandbox.repo("a.git");
    let b = sandbox.repo("b.git");
    let remote = sandbox.repo("remote.git");
    let initial = record(&a, None, OLD, PROFILE)?;
    push_local(&a, &remote, initial)?;
    let incoming = fetch_local(&b, &remote, "first")?;
    advance(&b, None, incoming)?;
    let edited = record(&b, Some(incoming), NEW, PROFILE)?;
    push_local(&b, &remote, edited)?;
    let fetched = fetch_local(&a, &remote, "second")?;
    advance(&a, Some(initial), fetched)?;
    let restored = restore(&a, fetched, initial)?;
    assert_eq!(read(&a, restored, PROJECT)?.source, OLD);
    assert_eq!(a.find_commit(restored)?.parent_id(0)?, edited);
    let version = git2::Version::get();
    println!(
        "PASS vendored={} libgit2={:?} snapshots/fetch/push/restore; no external Git invoked",
        version.vendored(),
        version.libgit2_version()
    );
    Ok(())
}
