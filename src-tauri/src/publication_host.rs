//! Immutable publication derivatives only. One helper, one replaceable pending capture.
use super::*;
use screenwriter_core::documents::{MAX_SOURCE_BYTES, recovery::source_hash};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
const TREE: &str = "c805d61692438d7ce7a8e5cd4fb0918b492296e41343be4a2847da7ad88748a8";
const MAX_STDOUT: u64 = 64 * 1024;
const MAX_PDF: u64 = 256 * 1024 * 1024;
const MAX_ID: u64 = 9_007_199_254_740_991;
pub const PROFILE: &str = "us-letter-draft-v1";
pub const FONT_SET: &str = "courier-prime-screenplain-0.12.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenderRequest {
    pub identity: DocumentRequest,
    pub request_id: u64,
    pub version: u64,
    pub source: Vec<u8>,
    pub source_sha256: String,
    pub profile: String,
    pub font_set: String,
    pub options: RenderOptions,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenderOptions {}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CancelRequest {
    pub identity: DocumentRequest,
    pub request_id: u64,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublicationError {
    RendererUnavailable,
    QueueFull,
    InvalidRequest,
    InvalidIdentity,
    StaleVersion,
    Cancelled,
    Timeout,
    HelperKilled,
    HelperCrashed,
    InvalidResponse,
    CacheUnavailable,
    BadRequest,
    UnsupportedProtocol,
    UnsupportedProfile,
    OutputInvalid,
    OutputExists,
    SourceTooLarge,
    InvalidUtf8,
    FontIntegrity,
    RenderFailed,
    Internal,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FontIdentity {
    pub file: String,
    pub sha256: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RendererIdentity {
    pub python: String,
    pub screenplain: String,
    pub reportlab: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicationWarning {
    pub code: String,
    pub message: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenderResult {
    pub identity: DocumentRequest,
    pub request_id: u64,
    pub version: u64,
    pub source_sha256: String,
    pub source_bytes: usize,
    pub artifact: String,
    pub page_count: u32,
    pub profile: String,
    pub profile_frozen: bool,
    pub font_set: String,
    pub renderer: RendererIdentity,
    pub fonts: Vec<FontIdentity>,
    pub source_map: String,
    pub warnings: Vec<PublicationWarning>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HelperSuccess {
    protocol: u32,
    ok: bool,
    page_count: u32,
    source_sha256: String,
    source_bytes: usize,
    profile: String,
    profile_frozen: bool,
    renderer: RendererIdentity,
    fonts: Vec<FontIdentity>,
    source_map: String,
    warnings: Vec<PublicationWarning>,
}
type Reply = mpsc::Sender<Result<RenderResult, PublicationError>>;
struct Job {
    request: RenderRequest,
    reply: Reply,
    cancel: Arc<AtomicBool>,
    serial: u64,
}
#[derive(Default)]
struct Queue {
    running: bool,
    cache_failed: bool,
    serial: u64,
    pending: Option<Job>,
    current: Option<(DocumentRequest, u64, Arc<AtomicBool>)>,
    latest: HashMap<String, (u64, u64, String)>,
    artifact: Option<(DocumentRequest, PathBuf)>,
}
struct Inner {
    queue: Mutex<Queue>,
    runtime: PathBuf,
    cache: PathBuf,
    timeout: Duration,
    _cache_lease: fs::File,
}
#[derive(Clone, Default)]
pub struct PublicationHost {
    inner: Arc<Mutex<Option<Arc<Inner>>>>,
}
impl PublicationHost {
    pub fn initialize(&self, runtime: PathBuf, cache: PathBuf) -> Result<(), PublicationError> {
        let mut directory = fs::DirBuilder::new();
        directory.recursive(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            directory.mode(0o700);
        }
        directory
            .create(&cache)
            .map_err(|_| PublicationError::CacheUnavailable)?;
        #[cfg(target_os = "linux")]
        screenwriter_core::documents::ensure_private_app_dir(&cache)
            .map_err(|_| PublicationError::CacheUnavailable)?;
        #[cfg(not(target_os = "linux"))]
        return Err(PublicationError::RendererUnavailable);
        let cache_lease = lease_cache(&cache)?;
        // Dedicated private cache: only our regular PDF artifacts are removed.
        for entry in fs::read_dir(&cache).map_err(|_| PublicationError::CacheUnavailable)? {
            let entry = entry.map_err(|_| PublicationError::CacheUnavailable)?;
            if entry.file_name() == ".lock" {
                continue;
            }
            if entry
                .file_type()
                .map_err(|_| PublicationError::CacheUnavailable)?
                .is_file()
                && entry.file_name().to_string_lossy().starts_with("render-")
                && entry.path().extension().is_some_and(|s| s == "pdf")
            {
                fs::remove_file(entry.path()).map_err(|_| PublicationError::CacheUnavailable)?;
            } else {
                return Err(PublicationError::CacheUnavailable);
            }
        }
        *self.inner.lock().map_err(|_| PublicationError::Internal)? = Some(Arc::new(Inner {
            queue: Mutex::new(Queue::default()),
            runtime,
            cache,
            timeout: Duration::from_secs(70),
            _cache_lease: cache_lease,
        }));
        Ok(())
    }
    fn get(&self) -> Result<Arc<Inner>, PublicationError> {
        self.inner
            .lock()
            .map_err(|_| PublicationError::Internal)?
            .clone()
            .ok_or(PublicationError::RendererUnavailable)
    }
    fn submit(
        &self,
        request: RenderRequest,
    ) -> Result<mpsc::Receiver<Result<RenderResult, PublicationError>>, PublicationError> {
        validate(&request)?;
        let inner = self.get()?;
        let mut q = inner.queue.lock().map_err(|_| PublicationError::Internal)?;
        if q.cache_failed {
            return Err(PublicationError::CacheUnavailable);
        }
        let key = request.identity.handle.clone();
        if let Some((id, version, hash)) = q.latest.get(&key)
            && (request.request_id <= *id
                || request.version < *version
                || (request.version == *version && request.source_sha256 != *hash))
        {
            return Err(PublicationError::StaleVersion);
        }
        if q.latest.len() >= screenwriter_core::documents::MAX_OPEN_DOCUMENTS
            && !q.latest.contains_key(&key)
        {
            return Err(PublicationError::InvalidRequest);
        }
        if let Some((_, _, cancel)) = &q.current {
            cancel.store(true, Ordering::SeqCst);
        }
        if let Some(old) = q.pending.take() {
            let _ = old.reply.send(Err(PublicationError::Cancelled));
        }
        if let Some((_, path)) = q.artifact.take()
            && remove_artifact(&path).is_err()
        {
            q.cache_failed = true;
            return Err(PublicationError::CacheUnavailable);
        }
        q.latest.insert(
            key,
            (
                request.request_id,
                request.version,
                request.source_sha256.clone(),
            ),
        );
        q.serial += 1;
        let serial = q.serial;
        let (reply, receiver) = mpsc::channel();
        q.pending = Some(Job {
            request,
            reply,
            serial,
            cancel: Arc::new(AtomicBool::new(false)),
        });
        if !q.running {
            q.running = true;
            let worker = inner.clone();
            // Exactly one drain worker; pending captures replace one another before starting.
            tauri::async_runtime::spawn_blocking(move || drain(worker));
        }
        Ok(receiver)
    }
    pub fn cancel(
        &self,
        request: Option<&CancelRequest>,
        close: bool,
    ) -> Result<(), PublicationError> {
        let inner = self.get()?;
        let mut q = inner.queue.lock().map_err(|_| PublicationError::Internal)?;
        let matches = |identity: &DocumentRequest, id: u64| {
            request.is_none_or(|r| r.identity == *identity && (close || r.request_id == id))
        };
        if let Some((identity, id, cancel)) = &q.current
            && matches(identity, *id)
        {
            cancel.store(true, Ordering::SeqCst);
        }
        if q.pending
            .as_ref()
            .is_some_and(|j| matches(&j.request.identity, j.request.request_id))
        {
            let old = q.pending.take().unwrap();
            let _ = old.reply.send(Err(PublicationError::Cancelled));
        }
        if q.artifact.as_ref().is_some_and(|(identity, _)| {
            matches(identity, q.latest.get(&identity.handle).map_or(0, |x| x.0))
        }) {
            let (_, path) = q.artifact.take().unwrap();
            if remove_artifact(&path).is_err() {
                q.cache_failed = true;
                return Err(PublicationError::CacheUnavailable);
            }
        }
        if close {
            if let Some(r) = request {
                q.latest.remove(&r.identity.handle);
            } else {
                q.latest.clear();
            }
        }
        Ok(())
    }
}
fn validate(r: &RenderRequest) -> Result<(), PublicationError> {
    if r.source.len() > MAX_SOURCE_BYTES {
        return Err(PublicationError::SourceTooLarge);
    }
    if std::str::from_utf8(&r.source).is_err() {
        return Err(PublicationError::InvalidUtf8);
    }
    if r.version == 0
        || r.version > MAX_ID
        || r.request_id == 0
        || r.request_id > MAX_ID
        || source_hash(&r.source) != r.source_sha256
        || r.font_set != FONT_SET
    {
        return Err(PublicationError::InvalidRequest);
    }
    if r.profile != PROFILE {
        return Err(PublicationError::UnsupportedProfile);
    }
    Ok(())
}
fn drain(inner: Arc<Inner>) {
    loop {
        let mut job = {
            let mut q = inner.queue.lock().unwrap();
            let Some(job) = q.pending.take() else {
                q.running = false;
                q.current = None;
                return;
            };
            q.current = Some((
                job.request.identity.clone(),
                job.request.request_id,
                job.cancel.clone(),
            ));
            job
        };
        let handle = format!("render-{}-{}", std::process::id(), job.serial);
        let path = inner.cache.join(format!("{handle}.pdf"));
        let result = render(&inner, &mut job, &path, handle);
        // Publication and admission share a lock: a superseded job can never publish.
        let mut q = inner.queue.lock().unwrap();
        let mut result = if job.cancel.load(Ordering::SeqCst) || q.serial != job.serial {
            Err(PublicationError::Cancelled)
        } else {
            result
        };
        if result.is_ok() {
            q.artifact = Some((job.request.identity.clone(), path.clone()));
        } else {
            if remove_artifact(&path).is_err() {
                q.cache_failed = true;
                result = Err(PublicationError::CacheUnavailable);
            }
        }
        q.current = None;
        if job.reply.send(result).is_err() {
            if remove_artifact(&path).is_err() {
                q.cache_failed = true;
            }
            q.artifact = None;
        }
    }
}
fn runtime_ready(runtime: &Path) -> bool {
    let manifest = fs::File::open(runtime.join("BUILD.json"))
        .ok()
        .and_then(|f| serde_json::from_reader::<_, serde_json::Value>(f.take(1024 * 1024)).ok());
    if !manifest.is_some_and(|v| v["protocol"] == 1 && v["treeSha256"] == TREE) {
        return false;
    }
    let executable = runtime.join("python/bin/python3.13");
    let Ok(metadata) = fs::metadata(executable) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o111 == 0 {
            return false;
        }
    }
    metadata.is_file() && runtime.join("app/babel_pdf_helper.py").is_file()
}
fn render(
    inner: &Inner,
    job: &mut Job,
    output: &Path,
    handle: String,
) -> Result<RenderResult, PublicationError> {
    if job.cancel.load(Ordering::SeqCst) {
        return Err(PublicationError::Cancelled);
    }
    if !runtime_ready(&inner.runtime) {
        return Err(PublicationError::RendererUnavailable);
    }
    let request = &mut job.request;
    let source_len = request.source.len();
    let argument =
        serde_json::json!({"protocol":1,"profile":request.profile,"output":output}).to_string();
    let mut command = Command::new(inner.runtime.join("python/bin/python3.13"));
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .args(["-I", "-S", "-B"])
        .arg(inner.runtime.join("app/babel_pdf_helper.py"))
        .arg(argument)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| PublicationError::RendererUnavailable)?;
    let mut input = child.stdin.take().unwrap();
    let source = std::mem::take(&mut request.source);
    let writer = std::thread::spawn(move || input.write_all(&source));
    let stdout = child.stdout.take().unwrap();
    let overflow = Arc::new(AtomicBool::new(false));
    let reader_overflow = overflow.clone();
    let reader = std::thread::spawn(move || {
        let mut data = Vec::new();
        let result = stdout.take(MAX_STDOUT + 1).read_to_end(&mut data);
        if data.len() as u64 > MAX_STDOUT {
            reader_overflow.store(true, Ordering::SeqCst);
        }
        result.map(|_| data)
    });
    let start = Instant::now();
    let status = loop {
        let failure = if job.cancel.load(Ordering::SeqCst) {
            Some(PublicationError::Cancelled)
        } else if overflow.load(Ordering::SeqCst) {
            Some(PublicationError::InvalidResponse)
        } else if start.elapsed() >= inner.timeout {
            Some(PublicationError::Timeout)
        } else {
            None
        };
        if let Some(error) = failure {
            kill_helper(&mut child);
            let _ = child.wait();
            let _ = writer.join();
            let _ = reader.join();
            return Err(error);
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(_) => {
                kill_helper(&mut child);
                let _ = child.wait();
                let _ = writer.join();
                let _ = reader.join();
                return Err(PublicationError::HelperCrashed);
            }
        }
    };
    kill_helper(&mut child);
    let written = writer.join().map_err(|_| PublicationError::Internal)?;
    let stdout = reader
        .join()
        .map_err(|_| PublicationError::Internal)?
        .map_err(|_| PublicationError::InvalidResponse)?;
    if stdout.len() as u64 > MAX_STDOUT {
        return Err(PublicationError::InvalidResponse);
    }
    if status.code().is_none() {
        #[cfg(unix)]
        {
            use std::os::unix::process::ExitStatusExt;
            if status.signal() == Some(9) || status.signal() == Some(15) {
                return Err(PublicationError::HelperKilled);
            }
        }
        return Err(PublicationError::HelperCrashed);
    }
    let json: serde_json::Value =
        serde_json::from_slice(&stdout).map_err(|_| PublicationError::InvalidResponse)?;
    if !status.success() {
        if status.code() != Some(2) || json["protocol"] != 1 || json["ok"] != false {
            return Err(PublicationError::HelperCrashed);
        }
        return Err(helper_error(json["error"]["code"].as_str().unwrap_or("")));
    }
    written.map_err(|_| PublicationError::InvalidResponse)?;
    let result: HelperSuccess =
        serde_json::from_value(json).map_err(|_| PublicationError::InvalidResponse)?;
    if result.protocol != 1
        || !result.ok
        || result.source_sha256 != request.source_sha256
        || result.source_bytes != source_len
        || result.profile != request.profile
        || !result.profile_frozen
        || result.source_map != "unsupported"
        || result.page_count == 0
        || !valid_renderer(&result.renderer, &result.fonts)
    {
        return Err(PublicationError::InvalidResponse);
    }
    let metadata = fs::symlink_metadata(output).map_err(|_| PublicationError::InvalidResponse)?;
    let mut header = [0; 5];
    if !metadata.is_file()
        || metadata.len() > MAX_PDF
        || fs::File::open(output)
            .and_then(|mut f| f.read_exact(&mut header))
            .is_err()
        || &header != b"%PDF-"
    {
        return Err(PublicationError::InvalidResponse);
    }
    Ok(RenderResult {
        identity: request.identity.clone(),
        request_id: request.request_id,
        version: request.version,
        source_sha256: result.source_sha256,
        source_bytes: result.source_bytes,
        artifact: handle,
        page_count: result.page_count,
        profile: result.profile,
        profile_frozen: true,
        font_set: request.font_set.clone(),
        renderer: result.renderer,
        fonts: result.fonts,
        source_map: result.source_map,
        warnings: result.warnings,
    })
}
fn valid_renderer(renderer: &RendererIdentity, fonts: &[FontIdentity]) -> bool {
    let pins: serde_json::Value =
        serde_json::from_str(include_str!("../../tools/pdf-helper/pins.json")).unwrap();
    renderer.python == "3.13.16"
        && renderer.screenplain == "0.12.0"
        && renderer.reportlab == "4.4.7"
        && fonts.len() == 4
        && pins["fonts"]
            .as_object()
            .unwrap()
            .iter()
            .all(|(path, hash)| {
                fonts
                    .iter()
                    .filter(|f| {
                        path.ends_with(&format!("/{}", f.file)) && hash.as_str() == Some(&f.sha256)
                    })
                    .count()
                    == 1
            })
}
fn helper_error(code: &str) -> PublicationError {
    use PublicationError::*;
    match code {
        "bad-request" => BadRequest,
        "unsupported-protocol" => UnsupportedProtocol,
        "unsupported-profile" => UnsupportedProfile,
        "output-invalid" => OutputInvalid,
        "output-exists" => OutputExists,
        "source-too-large" => SourceTooLarge,
        "invalid-utf8" => InvalidUtf8,
        "font-integrity" => FontIntegrity,
        "render-failed" => RenderFailed,
        "internal" => Internal,
        _ => InvalidResponse,
    }
}
#[tauri::command]
pub async fn render_publication(
    request: RenderRequest,
    documents: tauri::State<'_, DocumentHost>,
    state: tauri::State<'_, PublicationHost>,
) -> Result<RenderResult, PublicationError> {
    if request.source.len() > MAX_SOURCE_BYTES {
        return Err(PublicationError::SourceTooLarge);
    }
    // Share the native 8-job / 32 MiB admission budget before dispatching captures.
    let permit = documents
        .reserve(request.source.len())
        .map_err(|_| PublicationError::QueueFull)?;
    let documents = documents.inner().clone();
    let host = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let receiver = {
            let service = documents
                .service
                .lock()
                .map_err(|_| PublicationError::Internal)?;
            #[cfg(target_os = "linux")]
            service
                .as_ref()
                .ok_or(PublicationError::InvalidIdentity)?
                .read_initial(&request.identity)
                .map_err(|_| PublicationError::InvalidIdentity)?;
            #[cfg(not(target_os = "linux"))]
            return Err(PublicationError::RendererUnavailable);
            host.submit(request)?
        };
        receiver.recv().map_err(|_| PublicationError::Internal)?
    })
    .await
    .map_err(|_| PublicationError::Internal)?
}
#[tauri::command]
pub async fn cancel_publication(
    request: CancelRequest,
    state: tauri::State<'_, PublicationHost>,
) -> Result<(), PublicationError> {
    let host = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || host.cancel(Some(&request), false))
        .await
        .map_err(|_| PublicationError::Internal)?
}

fn kill_helper(child: &mut std::process::Child) {
    #[cfg(unix)]
    // SAFETY: positive child PID; process_group(0) isolates this helper and its descendants.
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    let _ = child.kill();
}
#[cfg(all(test, target_os = "linux"))]
#[path = "publication_tests.rs"]
mod tests;

fn lease_cache(cache: &Path) -> Result<fs::File, PublicationError> {
    let mut options = fs::OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600).custom_flags(libc::O_NOFOLLOW);
    }
    let file = options
        .open(cache.join(".lock"))
        .map_err(|_| PublicationError::CacheUnavailable)?;
    #[cfg(unix)]
    {
        use std::{os::fd::AsRawFd, os::unix::fs::MetadataExt};
        let metadata = file
            .metadata()
            .map_err(|_| PublicationError::CacheUnavailable)?;
        // SAFETY: no arguments to geteuid; flock operates on a live, owned descriptor.
        if !metadata.is_file()
            || metadata.nlink() != 1
            || metadata.mode() & 0o077 != 0
            || metadata.uid() != unsafe { libc::geteuid() }
            || unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0
        {
            return Err(PublicationError::CacheUnavailable);
        }
    }
    Ok(file)
}

fn remove_artifact(path: &Path) -> std::io::Result<()> {
    match fs::remove_file(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        result => result,
    }
}
