//! Disposable owned test directories. No service or manuscript policy is shared here.
use std::{
    fs, io,
    ops::Deref,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT: AtomicU64 = AtomicU64::new(0);

pub struct TestRoot {
    path: PathBuf,
    cleaned: bool,
}
impl TestRoot {
    pub fn new(env: &str, prefix: &str) -> Self {
        Self::with_options(env, prefix, Some(0o700), false)
    }
    pub fn with_options(env: &str, prefix: &str, mode: Option<u32>, recursive: bool) -> Self {
        let base = std::env::var_os(env)
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!(
            "{prefix}-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        if recursive {
            fs::create_dir_all(&path).unwrap();
        } else {
            fs::create_dir(&path).unwrap();
        }
        if let Some(mode) = mode {
            fs::set_permissions(&path, fs::Permissions::from_mode(mode)).unwrap();
        }
        Self {
            path,
            cleaned: false,
        }
    }
    pub fn write(&self, name: impl AsRef<Path>, bytes: impl AsRef<[u8]>, mode: u32) -> PathBuf {
        let path = self.path.join(name);
        fs::write(&path, bytes).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(mode)).unwrap();
        path
    }
    // Local hooks can retain their original strict or best-effort cleanup policy.
    pub fn cleanup(&mut self) -> io::Result<()> {
        self.cleaned = true;
        fs::remove_dir_all(&self.path)
    }
}
impl Deref for TestRoot {
    type Target = Path;
    fn deref(&self) -> &Path {
        &self.path
    }
}
impl AsRef<Path> for TestRoot {
    fn as_ref(&self) -> &Path {
        &self.path
    }
}
impl Drop for TestRoot {
    fn drop(&mut self) {
        if !self.cleaned {
            self.cleanup().unwrap();
        }
    }
}

// Child-process fixtures inherit the parent's disposable root without recreating it.
impl From<PathBuf> for TestRoot {
    fn from(path: PathBuf) -> Self {
        Self {
            path,
            cleaned: false,
        }
    }
}
impl AsRef<std::ffi::OsStr> for TestRoot {
    fn as_ref(&self) -> &std::ffi::OsStr {
        self.path.as_os_str()
    }
}
