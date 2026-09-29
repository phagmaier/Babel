//! Native Save As: exclusive file publication plus a fresh loose registration.
//!
//! The source registration is only validated, never mutated; its recovery and
//! ownership survive every outcome. Publication order is: validate, exclusive
//! temporary write with sync and byte verification, exclusive rename (an
//! existing destination fails closed), directory sync, final byte
//! verification, fresh identity record, then the new registration. A crash
//! leaves at most a `.babel-save-as-*.pending` orphan beside an untouched
//! source; orphans are never promoted or silently deleted.
use super::*;
use crate::documents::{persistence::payload_cost, save_as::*, snapshots::StorageRelation};

pub(super) struct SaveDestination {
    pub identity: DocumentRequest,
    dir: File,
    path: PathBuf,
    file_name: OsString,
    relation: StorageRelation,
}

/// Interruption points for crash drills. Production passes a no-op gate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum SaveAsStage {
    TempWritten,
    Published,
    IdentityRecorded,
}

fn valid_file_name(name: &OsStr) -> Result<String, DocumentError> {
    let text = name
        .to_str()
        .ok_or_else(|| error(ErrorCode::InvalidDestination))?;
    if text.is_empty()
        || text == "."
        || text == ".."
        || text.len() > 255
        || text.chars().any(char::is_control)
    {
        return Err(error(ErrorCode::InvalidDestination));
    }
    Ok(text.to_string())
}

fn destination_checks(dir: &File) -> Result<(), DocumentError> {
    let info = stat(dir)?;
    if info.st_uid != geteuid().as_raw()
        || info.st_mode & 0o7022 != 0
        || info.st_mode & 0o300 != 0o300
    {
        return Err(error(ErrorCode::InvalidDestination));
    }
    source_store::plain_metadata(dir)
}

/// Exclusive temporary write with sync and exact byte verification.
fn write_temp(dir: &File, name: &str, bytes: &[u8]) -> Result<(), DocumentError> {
    let mut file = File::from(
        fs::openat(
            dir,
            name,
            OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::from_raw_mode(0o600),
        )
        .map_err(syscall_error)?,
    );
    file.write_all(bytes).map_err(io_error)?;
    file.sync_all().map_err(io_error)?;
    let (back, _) = snapshot(
        File::from(
            fs::openat(
                dir,
                name,
                OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(syscall_error)?,
        ),
        bytes.len(),
    )?;
    if back != bytes {
        return Err(error(ErrorCode::Io));
    }
    Ok(())
}

impl DocumentService {
    /// Called only after explicit native file-save selection. No IPC accepts a path.
    pub fn select_save_destination(
        &mut self,
        identity: &DocumentRequest,
        path: &Path,
    ) -> Result<SaveTarget, DocumentError> {
        self.registered(identity)?;
        self.check_capacity()?;
        if self.save_destinations.len() >= MAX_OPEN_DOCUMENTS {
            return Err(error(ErrorCode::InvalidDestination));
        }
        let name = path
            .file_name()
            .ok_or_else(|| error(ErrorCode::UnsafePath))?;
        let file_name = valid_file_name(name)?;
        let parent = path.parent().ok_or_else(|| error(ErrorCode::UnsafePath))?;
        let dir = directory(parent)?;
        destination_checks(&dir)?;
        // Advisory fast-fail; the exclusive rename at publication is authoritative.
        match fs::openat(
            &dir,
            name,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
            Mode::empty(),
        ) {
            Ok(_) => return Err(error(ErrorCode::InvalidDestination)),
            Err(Errno::NOENT) => (),
            Err(_) => return Err(error(ErrorCode::InvalidDestination)),
        }
        let info = stat(&dir)?;
        let source_device = self
            .registered(identity)?
            .baseline
            .as_ref()
            .map(|f| f.device.clone())
            .unwrap_or(stat(&self.store)?.st_dev.to_string());
        let relation = if info.st_dev.to_string() == source_device {
            StorageRelation::SameFilesystem
        } else {
            StorageRelation::UnknownPhysicalDisk
        };
        let token = uuid();
        self.save_destinations.insert(
            token.clone(),
            SaveDestination {
                identity: identity.clone(),
                dir,
                path: parent.components().collect(),
                file_name: name.to_os_string(),
                relation,
            },
        );
        Ok(SaveTarget {
            token,
            file_name,
            storage_relation: relation,
        })
    }

    /// Publishes the checkpoint bytes to the selected file and opens a fresh
    /// loose registration. The source registration is never mutated.
    pub fn save_as_copy(
        &mut self,
        request: &SaveAsRequest,
    ) -> Result<SaveAsReceipt, DocumentError> {
        self.save_as_copy_with(request, &mut |_| Ok(()))
    }

    fn save_as_copy_with(
        &mut self,
        request: &SaveAsRequest,
        gate: &mut impl FnMut(SaveAsStage) -> Result<(), DocumentError>,
    ) -> Result<SaveAsReceipt, DocumentError> {
        let c = &request.checkpoint;
        self.registered(&c.identity)?;
        payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
        if hash(&c.source) != c.source_sha256 {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        let destination = self
            .save_destinations
            .get(&request.destination_token)
            .filter(|d| d.identity == c.identity)
            .ok_or_else(|| error(ErrorCode::InvalidDestination))?;
        // Revalidate the held directory before touching the filesystem.
        self.registered(&c.identity)?;
        let current = directory(&destination.path)?;
        let info = stat(&current)?;
        if !same_file(&info, &stat(&destination.dir)?) {
            return Err(error(ErrorCode::InvalidDestination));
        }
        destination_checks(&current)?;
        self.check_capacity()?;
        let temp = format!(".babel-save-as-{}.pending", uuid());
        let cleanup = |dir: &File| {
            let _ = fs::unlinkat(dir, temp.as_str(), rustix::fs::AtFlags::empty());
        };
        if let Err(err) = write_temp(&destination.dir, &temp, &c.source) {
            cleanup(&destination.dir);
            return Err(err);
        }
        if let Err(err) = gate(SaveAsStage::TempWritten) {
            cleanup(&destination.dir);
            return Err(err);
        }
        // Authoritative existing-destination refusal: never overwrite.
        if let Err(err) = fs::renameat_with(
            &destination.dir,
            temp.as_str(),
            &destination.dir,
            destination.file_name.as_os_str(),
            fs::RenameFlags::NOREPLACE,
        ) {
            cleanup(&destination.dir);
            return Err(if err == Errno::EXIST {
                error(ErrorCode::InvalidDestination)
            } else {
                syscall_error(err)
            });
        }
        destination.dir.sync_all().map_err(io_error)?;
        let (published, _) = snapshot(
            read_file(&destination.dir, &destination.file_name)?,
            MAX_SOURCE_BYTES,
        )?;
        if published != c.source {
            return Err(error(ErrorCode::Io));
        }
        gate(SaveAsStage::Published)?;
        // The file is provably new, so any existing identity record for this
        // path belongs to a previous occupant: replace it with a fresh ID.
        let file_path: PathBuf = destination.path.join(&destination.file_name);
        let fresh_id = self.replace_loose_identity(&file_path)?;
        gate(SaveAsStage::IdentityRecorded)?;
        let relation = destination.relation;
        let file_name = destination
            .file_name
            .to_str()
            .ok_or_else(|| error(ErrorCode::InvalidDestination))?
            .to_string();
        match self.open_selected(&file_path) {
            Ok(opened)
                if opened.kind == DocumentKind::Loose
                    && opened.identity.document_id == fresh_id
                    && opened.persistent_identity =>
            {
                self.save_destinations.remove(&request.destination_token);
                Ok(SaveAsReceipt {
                    document: opened,
                    version: c.version,
                    source_sha256: c.source_sha256.clone(),
                    file_name,
                    storage_relation: relation,
                })
            }
            Ok(opened) => {
                // Managed-project adoption: refuse rather than hijack a project.
                let _ = self.release(&opened.identity);
                Err(error(ErrorCode::InvalidDestination))
            }
            Err(err) => Err(err),
        }
    }

    /// Mints a fresh loose identity record, replacing a stale mapping: the
    /// caller has just exclusively published this path, so any existing
    /// record belongs to a previous occupant. Crash orphans use a distinct
    /// temporary name and never interfere with exclusive creation elsewhere.
    fn replace_loose_identity(&self, file_path: &Path) -> Result<String, DocumentError> {
        use std::os::unix::ffi::OsStrExt;
        let key = hash(file_path.as_os_str().as_bytes());
        let _registration_lease = self.lease(&format!("registry:{key}"))?;
        let document_id = uuid();
        let bytes = serde_json::to_vec(&LooseIdentity {
            schema_version: 1,
            document_id: document_id.clone(),
        })
        .map_err(|_| error(ErrorCode::IdentityStoreUnavailable))?;
        let name = format!("{key}.identity.json");
        let temp = format!("{name}.tmp.{}", uuid());
        let mut file = File::from(
            fs::openat(
                &self.store,
                temp.as_str(),
                OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::from_raw_mode(0o600),
            )
            .map_err(syscall_error)?,
        );
        file.write_all(&bytes).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        drop(file);
        fs::renameat(&self.store, temp.as_str(), &self.store, name.as_str())
            .map_err(syscall_error)?;
        self.store.sync_all().map_err(io_error)?;
        self.verify_store()?;
        let stored = read_file(&self.store, OsStr::new(&name))?;
        if !private_file(&stat(&stored)?) {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        let (back, _) = snapshot(stored, MAX_METADATA_BYTES)?;
        let record: LooseIdentity = serde_json::from_slice(&back)
            .map_err(|_| error(ErrorCode::IdentityStoreUnavailable))?;
        if record.schema_version != 1 || record.document_id != document_id {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        Ok(document_id)
    }
}

#[cfg(test)]
#[path = "save_as_store_tests.rs"]
mod tests;
