//! Captured derivatives and Linux PDF publication, independent of source saves.
use super::*;
use crate::documents::{pdf::*, persistence::CheckpointRequest};
pub(super) struct PdfCapture {
    pub checkpoint: CheckpointRequest,
}
pub(super) struct PdfDestination {
    pub identity: DocumentRequest,
    capture_token: String,
    anchor: Anchor,
    original: Option<(Vec<u8>, DiskFingerprint, File)>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum PdfStage {
    CandidateWritten,
    PreviousProtected,
    BeforeInstall,
    Installed,
    Synced,
    Verified,
}
fn destination_dir(dir: &File) -> Result<(), DocumentError> {
    let info = stat(dir)?;
    if info.st_uid != geteuid().as_raw()
        || info.st_mode & 0o7022 != 0
        || info.st_mode & 0o300 != 0o300
    {
        return Err(error(ErrorCode::InvalidDestination));
    }
    source_store::plain_metadata(dir)
}
fn existing(anchor: &Anchor) -> Result<Option<(Vec<u8>, DiskFingerprint, File)>, DocumentError> {
    let file = match read_file(&anchor.parent, &anchor.name) {
        Ok(f) => f,
        Err(e) if e.code == ErrorCode::MissingSource => return Ok(None),
        Err(e) => return Err(e),
    };
    let info = stat(&file)?;
    if !private_file(&info) || info.st_mode & 0o200 == 0 {
        return Err(error(ErrorCode::InvalidDestination));
    }
    source_store::plain_metadata(&file)?;
    fs::flock(&file, FlockOperation::NonBlockingLockExclusive)
        .map_err(|_| error(ErrorCode::InvalidDestination))?;
    let (bytes, fingerprint) = snapshot(file.try_clone().map_err(io_error)?, MAX_PDF_BYTES)?;
    if !bytes.starts_with(b"%PDF-") {
        return Err(error(ErrorCode::InvalidDestination));
    }
    Ok(Some((bytes, fingerprint, file)))
}
fn read_pdf(dir: &File, name: &OsStr) -> Result<(Vec<u8>, DiskFingerprint), DocumentError> {
    snapshot(read_file(dir, name)?, MAX_PDF_BYTES)
}
fn write_new(dir: &File, name: &str, bytes: &[u8]) -> Result<DiskFingerprint, DocumentError> {
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
    let (back, fp) = read_pdf(dir, OsStr::new(name))?;
    if back != bytes {
        return Err(error(ErrorCode::Io));
    }
    Ok(fp)
}
fn same_inode(a: &DiskFingerprint, b: &DiskFingerprint) -> bool {
    a.device == b.device && a.inode == b.inode
}
fn unlink_ours(dir: &File, name: &OsStr, fp: &DiskFingerprint) {
    if read_pdf(dir, name)
        .is_ok_and(|(_, current)| same_inode(&current, fp) && current.sha256 == fp.sha256)
    {
        let _ = fs::unlinkat(dir, name, fs::AtFlags::empty());
    }
}
impl DocumentService {
    pub fn prepare_pdf_capture(
        &mut self,
        cp: &CheckpointRequest,
    ) -> Result<PdfCaptureReceipt, DocumentError> {
        self.registered(&cp.identity)?;
        let checkpoint = self.checkpoint(
            &cp.identity,
            cp.version,
            &cp.source,
            &cp.source_sha256,
            cp.draft_metadata.clone(),
        )?;
        let token = uuid();
        self.pdf_captures
            .retain(|_, c| c.checkpoint.identity != cp.identity);
        self.pdf_destinations
            .retain(|_, d| d.identity != cp.identity);
        self.pdf_captures.insert(
            token.clone(),
            PdfCapture {
                checkpoint: cp.clone(),
            },
        );
        Ok(PdfCaptureReceipt {
            identity: cp.identity.clone(),
            capture_token: token,
            version: cp.version,
            source_sha256: cp.source_sha256.clone(),
            checkpoint,
        })
    }
    pub fn pdf_capture(
        &self,
        identity: &DocumentRequest,
        token: &str,
    ) -> Result<CheckpointRequest, DocumentError> {
        self.registered(identity)?;
        self.pdf_captures
            .get(token)
            .filter(|c| c.checkpoint.identity == *identity)
            .map(|c| c.checkpoint.clone())
            .ok_or_else(|| error(ErrorCode::InvalidDestination))
    }
    pub fn cancel_pdf_capture(
        &mut self,
        identity: &DocumentRequest,
        token: &str,
    ) -> Result<(), DocumentError> {
        self.registered(identity)?;
        self.pdf_capture(identity, token)?;
        self.pdf_captures.remove(token);
        self.pdf_destinations.retain(|_, d| d.identity != *identity);
        Ok(())
    }
    fn pdf_path_allowed(&self, anchor: &Anchor) -> Result<(), DocumentError> {
        if anchor.path.starts_with(&self.store_path)
            || anchor.path.components().any(|c| matches!(c, Component::Normal(n) if n == ".screenwriter" || n.to_string_lossy().starts_with(".babel-")))
            || !anchor.path.extension().is_some_and(|e| e.eq_ignore_ascii_case("pdf")) {
            return Err(error(ErrorCode::InvalidDestination));
        }
        let name = anchor
            .name
            .to_str()
            .ok_or_else(|| error(ErrorCode::InvalidDestination))?;
        if name.len() > 255 || name.chars().any(char::is_control) {
            return Err(error(ErrorCode::InvalidDestination));
        }
        let selected = read_file(&anchor.parent, &anchor.name)
            .ok()
            .and_then(|f| stat(&f).ok());
        for record in self.documents.values() {
            if let Some(source) = &record.anchor {
                if source.path == anchor.path {
                    return Err(error(ErrorCode::InvalidDestination));
                }
                if let (Some(target), Ok(file)) =
                    (&selected, read_file(&source.parent, &source.name))
                    && same_file(target, &stat(&file)?)
                {
                    return Err(error(ErrorCode::InvalidDestination));
                }
            }
        }
        Ok(())
    }
    pub fn select_pdf_destination(
        &mut self,
        identity: &DocumentRequest,
        token: &str,
        path: &Path,
    ) -> Result<PdfTarget, DocumentError> {
        self.pdf_capture(identity, token)?;
        let anchor = Anchor::selected(path)?;
        self.pdf_path_allowed(&anchor)?;
        destination_dir(&anchor.parent)?;
        let original = existing(&anchor)?;
        let result = PdfTarget {
            token: uuid(),
            file_name: anchor
                .name
                .to_str()
                .ok_or_else(|| error(ErrorCode::InvalidDestination))?
                .to_string(),
            replaces_existing: original.is_some(),
        };
        self.pdf_destinations.retain(|_, d| d.identity != *identity);
        self.pdf_destinations.insert(
            result.token.clone(),
            PdfDestination {
                identity: identity.clone(),
                capture_token: token.to_string(),
                anchor,
                original,
            },
        );
        Ok(result)
    }
    /// Only the desktop artifact registry supplies PDF bytes to this native method.
    pub fn publish_pdf(
        &mut self,
        identity: &DocumentRequest,
        capture: &str,
        target: &str,
        bytes: &[u8],
    ) -> Result<PdfPublicationReceipt, DocumentError> {
        self.publish_pdf_with(identity, capture, target, bytes, &mut |_| Ok(()))
    }
    fn publish_pdf_with(
        &mut self,
        identity: &DocumentRequest,
        capture: &str,
        target: &str,
        bytes: &[u8],
        gate: &mut impl FnMut(PdfStage) -> Result<(), DocumentError>,
    ) -> Result<PdfPublicationReceipt, DocumentError> {
        self.pdf_capture(identity, capture)?;
        if bytes.len() > MAX_PDF_BYTES || !bytes.starts_with(b"%PDF-") {
            return Err(error(ErrorCode::InvalidDestination));
        }
        // Spend once, including failure; a retry requires fresh native selection.
        if !self
            .pdf_destinations
            .get(target)
            .is_some_and(|d| d.identity == *identity && d.capture_token == capture)
        {
            return Err(error(ErrorCode::InvalidDestination));
        }
        let destination = self.pdf_destinations.remove(target).unwrap();
        let a = &destination.anchor;
        a.verify_location()?;
        destination_dir(&a.parent)?;
        self.pdf_path_allowed(a)?;
        let _lease = self.lease(&format!(
            "pdf:{}",
            hash(a.path.as_os_str().as_encoded_bytes())
        ))?;
        let check_original = || -> Result<(), DocumentError> {
            match (&destination.original, read_pdf(&a.parent, &a.name)) {
                (Some((bytes, expected, _)), Ok((actual, fp)))
                    if actual == *bytes && fp == *expected =>
                {
                    Ok(())
                }
                (None, Err(e)) if e.code == ErrorCode::MissingSource => Ok(()),
                _ => Err(error(ErrorCode::SourceChanged)),
            }
        };
        check_original()?;
        let temp = format!(".babel-pdf-{}.pending", uuid());
        let previous = format!(".babel-pdf-{}.previous.pdf", uuid());
        let candidate = write_new(&a.parent, &temp, bytes)?;
        let preinstall = (|| {
            gate(PdfStage::CandidateWritten)?;
            if let Some((prior, _, _)) = &destination.original {
                write_new(&a.parent, &previous, prior)?;
                a.parent.sync_all().map_err(io_error)?;
            }
            gate(PdfStage::PreviousProtected)?;
            a.verify_location()?;
            destination_dir(&a.parent)?;
            self.pdf_path_allowed(a)?;
            check_original()?;
            gate(PdfStage::BeforeInstall)?;
            // Tests may simulate an external rename at the last recheck boundary.
            check_original()?;
            let flags = if destination.original.is_some() {
                fs::RenameFlags::EXCHANGE
            } else {
                fs::RenameFlags::NOREPLACE
            };
            fs::renameat_with(&a.parent, temp.as_str(), &a.parent, &a.name, flags)
                .map_err(syscall_error)
        })();
        if let Err(e) = preinstall {
            unlink_ours(&a.parent, OsStr::new(&temp), &candidate);
            return Err(e);
        }
        let confirmation = (|| {
            if let Some((old, expected, _)) = &destination.original {
                let (displaced, fp) = read_pdf(&a.parent, OsStr::new(&temp))?;
                if displaced != *old || !same_inode(&fp, expected) {
                    return Err(error(ErrorCode::SourceChanged));
                }
            }
            gate(PdfStage::Installed)?;
            a.parent.sync_all().map_err(io_error)?;
            gate(PdfStage::Synced)?;
            a.verify_location()?;
            self.pdf_path_allowed(a)?;
            let (back, fp) = read_pdf(&a.parent, &a.name)?;
            if back != bytes || !same_inode(&fp, &candidate) {
                return Err(error(ErrorCode::SourceChanged));
            }
            gate(PdfStage::Verified)
        })();
        if let Err(e) = confirmation {
            // Never replace/unlink an unrelated concurrent generation during rollback.
            if !read_pdf(&a.parent, &a.name)
                .is_ok_and(|(current, fp)| current == bytes && same_inode(&fp, &candidate))
            {
                return Err(error(ErrorCode::ExportNeedsAttention));
            }
            let restored = if let Some((old, expected, _)) = &destination.original {
                if !read_pdf(&a.parent, OsStr::new(&temp))
                    .is_ok_and(|(displaced, fp)| displaced == *old && same_inode(&fp, expected))
                {
                    return Err(error(ErrorCode::ExportNeedsAttention));
                }
                fs::renameat_with(
                    &a.parent,
                    temp.as_str(),
                    &a.parent,
                    &a.name,
                    fs::RenameFlags::EXCHANGE,
                )
                .map_err(syscall_error)
            } else {
                fs::unlinkat(&a.parent, &a.name, fs::AtFlags::empty()).map_err(syscall_error)
            };
            if restored.is_err() || a.parent.sync_all().is_err() {
                return Err(error(ErrorCode::ExportNeedsAttention));
            }
            unlink_ours(&a.parent, OsStr::new(&temp), &candidate);
            return Err(e);
        }
        // The independently verified previous copy survives success and cleanup failure.
        // Cleanup does not retract a verified receipt; crash candidates are never promoted.
        if let Some((_, fp, _)) = &destination.original {
            unlink_ours(&a.parent, OsStr::new(&temp), fp);
        }
        self.pdf_captures.remove(capture);
        Ok(PdfPublicationReceipt {
            file_name: a.name.to_string_lossy().into_owned(),
            pdf_sha256: hash(bytes),
            byte_length: bytes.len(),
            previous_file_name: destination.original.as_ref().map(|_| previous),
        })
    }
}
#[cfg(test)]
#[path = "pdf_store_tests.rs"]
mod tests;
