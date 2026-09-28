//! Disposable M1-04 Linux proof. No app linkage, IPC, or live manuscript API.
#[cfg(target_os = "linux")]
pub mod linux {
    use std::fs::{self, File, OpenOptions};
    use std::io::{self, Read, Write};
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
    use std::path::{Path, PathBuf};

    pub const OLD: &[u8] =
        b"\xef\xbb\xbfTitle: Synthetic old\r\n\r\nINT. ROOM - DAY\r\n  Whitespace stays.  \r\n";
    pub const NEW: &[u8] = b"\xef\xbb\xbfTitle: Synthetic new\r\n\r\nINT. ROOM - DAY\r\n  Unknown [[region]] stays.  \r\n";

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Stage {
        RecoveryCreate,
        RecoveryWrite,
        RecoverySync,
        PriorCreate,
        PriorWrite,
        PriorSync,
        ProtectionDirectorySync,
        TempCreate,
        TempWrite,
        TempSync,
        TempVerify,
        Recheck,
        Replace,
        DirectorySync,
        FinalVerify,
    }

    pub const STAGES: &[Stage] = &[
        Stage::RecoveryCreate,
        Stage::RecoveryWrite,
        Stage::RecoverySync,
        Stage::PriorCreate,
        Stage::PriorWrite,
        Stage::PriorSync,
        Stage::ProtectionDirectorySync,
        Stage::TempCreate,
        Stage::TempWrite,
        Stage::TempSync,
        Stage::TempVerify,
        Stage::Recheck,
        Stage::Replace,
        Stage::DirectorySync,
        Stage::FinalVerify,
    ];

    #[derive(Debug)]
    pub struct Failure {
        pub stage: Stage,
        /// A rename may have succeeded even though no receipt can be issued.
        pub replaced: bool,
        pub error: io::Error,
    }

    #[derive(Debug, PartialEq, Eq)]
    pub struct Receipt {
        pub version: u64,
        /// Exact bytes instead of a digest in this tiny dependency-free proof.
        pub source: Vec<u8>,
    }

    #[derive(Debug, PartialEq, Eq)]
    struct Fingerprint {
        dev: u64,
        ino: u64,
        mode: u32,
        bytes: Vec<u8>,
    }

    fn fingerprint(path: &Path) -> io::Result<Fingerprint> {
        let meta = fs::symlink_metadata(path)?;
        if !meta.is_file() || meta.nlink() != 1 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "regular, single-link proof file required",
            ));
        }
        if meta.mode() & 0o222 == 0 {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "read-only source",
            ));
        }
        // Disposable directory is trusted; production needs handle-relative,
        // no-follow opens and owner/ACL/xattr policy, not this path check.
        Ok(Fingerprint {
            dev: meta.dev(),
            ino: meta.ino(),
            mode: meta.mode() & 0o777,
            bytes: fs::read(path)?,
        })
    }

    fn exclusive(path: &Path) -> io::Result<File> {
        OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)
    }

    fn verify(path: &Path, expected: &[u8]) -> io::Result<()> {
        if fs::read(path)? != expected {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "byte verification failed",
            ));
        }
        Ok(())
    }

    struct WriterLease(File);
    impl Drop for WriterLease {
        fn drop(&mut self) {
            // Explicit release also covers transient fork-inherited descriptors
            // in concurrently spawning test threads. Close remains the fallback.
            let _ = self.0.unlock();
        }
    }

    /// Hooks run immediately before named real operations. They can return an
    /// error, alter a disposable artifact, or let a parent kill the process.
    /// Deliberately one replacement per fresh sandbox; leftovers are retained.
    pub fn replace(
        dir: &Path,
        version: u64,
        mut hook: impl FnMut(Stage) -> io::Result<()>,
        write_temp: impl FnOnce(&mut File, &[u8]) -> io::Result<()>,
    ) -> Result<Receipt, Failure> {
        let mut stage = Stage::RecoveryCreate;
        let mut replaced = false;
        let result = (|| -> io::Result<Receipt> {
            // Stable lock inode, separate from the source inode being replaced.
            // Cooperating writers only; never unlink this lock while in use.
            let lock = OpenOptions::new()
                .read(true)
                .write(true)
                .open(dir.join("writer.lock"))?;
            lock.try_lock().map_err(io::Error::from)?;
            let _lease = WriterLease(lock);
            let current = dir.join("current.src");
            let expected = fingerprint(&current)?;
            if expected.bytes != OLD {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "unexpected source generation",
                ));
            }
            let directory = File::open(dir)?;

            hook(stage)?;
            let recovery_path = dir.join("recovery.src");
            let mut recovery = exclusive(&recovery_path)?;
            stage = Stage::RecoveryWrite;
            hook(stage)?;
            recovery.write_all(NEW)?;
            stage = Stage::RecoverySync;
            hook(stage)?;
            recovery.sync_all()?;
            verify(&recovery_path, NEW)?;

            stage = Stage::PriorCreate;
            hook(stage)?;
            let prior_path = dir.join("previous.src");
            let mut prior = exclusive(&prior_path)?;
            stage = Stage::PriorWrite;
            hook(stage)?;
            prior.write_all(&expected.bytes)?;
            stage = Stage::PriorSync;
            hook(stage)?;
            prior.sync_all()?;
            verify(&prior_path, &expected.bytes)?;
            // Commit BOTH safety-copy directory entries before source rename.
            stage = Stage::ProtectionDirectorySync;
            hook(stage)?;
            directory.sync_all()?;

            stage = Stage::TempCreate;
            hook(stage)?;
            let temp_path = dir.join("candidate.src");
            let mut temp = exclusive(&temp_path)?;
            stage = Stage::TempWrite;
            hook(stage)?;
            write_temp(&mut temp, NEW)?;
            temp.flush()?;
            temp.set_permissions(fs::Permissions::from_mode(expected.mode))?;
            stage = Stage::TempSync;
            hook(stage)?;
            temp.sync_all()?;
            stage = Stage::TempVerify;
            hook(stage)?;
            verify(&temp_path, NEW)?;

            stage = Stage::Recheck;
            hook(stage)?;
            if fingerprint(&current)? != expected {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "external generation changed",
                ));
            }
            // Residual external-writer race exists between recheck and rename.
            stage = Stage::Replace;
            hook(stage)?;
            fs::rename(&temp_path, &current)?;
            replaced = true;
            stage = Stage::DirectorySync;
            hook(stage)?;
            directory.sync_all()?;
            stage = Stage::FinalVerify;
            hook(stage)?;
            let actual = fingerprint(&current)?;
            if actual.bytes != NEW || actual.mode != expected.mode {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "replaced bytes/mode changed",
                ));
            }
            Ok(Receipt {
                version,
                source: actual.bytes,
            })
        })();
        result.map_err(|error| Failure {
            stage,
            replaced,
            error,
        })
    }

    pub fn normal_write(file: &mut File, source: &[u8]) -> io::Result<()> {
        file.write_all(source)
    }

    /// Only this constructor creates the proof's private, randomly named
    /// directory and fixed synthetic contents. No existing screenplay is read.
    pub struct Sandbox(pub PathBuf);

    impl Sandbox {
        pub fn new(root: &Path) -> io::Result<Self> {
            let mut nonce = [0; 16];
            File::open("/dev/urandom")?.read_exact(&mut nonce)?;
            let name: String = nonce.iter().map(|byte| format!("{byte:02x}")).collect();
            let dir = root.join(format!("babel-replacement-{name}"));
            fs::DirBuilder::new().mode(0o700).create(&dir)?;
            let sandbox = Self(dir);
            let mut source = exclusive(&sandbox.0.join("current.src"))?;
            source.write_all(OLD)?;
            source.set_permissions(fs::Permissions::from_mode(0o640))?;
            source.sync_all()?;
            exclusive(&sandbox.0.join("writer.lock"))?.sync_all()?;
            File::open(&sandbox.0)?.sync_all()?;
            Ok(sandbox)
        }
    }

    impl Drop for Sandbox {
        fn drop(&mut self) {
            // Only the fresh, privately owned synthetic directory is removed.
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
