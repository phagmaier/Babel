//! Bounded blocking jobs. No guard crosses await; cancellation never interrupts a started write.
use super::*;
use screenwriter_core::documents::{
    history::{
        ImportProtectionReceipt, WorkflowOperation, WorkflowProtectionReceipt,
        WorkflowProtectionRequest,
    },
    persistence::{CheckpointFailure, CheckpointRequest, payload_cost},
    recovery::CheckpointReceipt,
    saving::{
        MAX_QUEUED_BYTES, MAX_QUEUED_SAVES, ReplacementState, SaveFailure, SaveReceipt, SaveRequest,
    },
};

#[derive(Debug, Default)]
pub(super) struct Budget {
    jobs: usize,
    bytes: usize,
}

#[derive(Debug)]
pub(super) struct Permit {
    budget: Arc<Mutex<Budget>>,
    bytes: usize,
}
impl Drop for Permit {
    fn drop(&mut self) {
        if let Ok(mut budget) = self.budget.lock() {
            budget.jobs -= 1;
            budget.bytes -= self.bytes;
        } else {
            debug_assert!(false, "budget mutex poisoned; budget leaked fail-closed");
        }
    }
}

impl DocumentHost {
    pub(super) fn reserve(&self, bytes: usize) -> Result<Permit, DocumentError> {
        let mut budget = self
            .budget
            .lock()
            .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
        if budget.jobs >= MAX_QUEUED_SAVES || bytes > MAX_QUEUED_BYTES.saturating_sub(budget.bytes)
        {
            return Err(DocumentError::new(ErrorCode::SaveQueueFull));
        }
        budget.jobs += 1;
        budget.bytes += bytes;
        Ok(Permit {
            budget: self.budget.clone(),
            bytes,
        })
    }

    pub(super) async fn read_worker(
        &self,
        request: DocumentRequest,
    ) -> Result<OpenDocument, DocumentError> {
        let permit = self.reserve(0)?;
        let host = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            host.read(&request)
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    pub(super) async fn release_worker(
        &self,
        request: DocumentRequest,
    ) -> Result<(), DocumentError> {
        let permit = self.reserve(0)?;
        let host = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            host.release(&request)
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    pub(super) async fn release_at_risk_worker(
        &self,
        request: DocumentRequest,
    ) -> Result<(), DocumentError> {
        let permit = self.reserve(0)?;
        let host = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            host.release_at_risk(&request)
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    async fn checkpoint(
        &self,
        request: CheckpointRequest,
    ) -> Result<CheckpointReceipt, CheckpointFailure> {
        let failure = |error| CheckpointFailure {
            identity: request.identity.clone(),
            version: request.version,
            error,
        };
        let cost = payload_cost(
            request.version,
            &request.source,
            &request.source_sha256,
            &request.draft_metadata,
        )
        .map_err(failure)?;
        let permit = self.reserve(cost).map_err(failure)?;
        let mut unavailable = failure(DocumentError::new(ErrorCode::NativeUnavailable));
        let join_failure = unavailable.clone();
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker.lock().map_err(|_| unavailable.clone())?;
            #[cfg(target_os = "linux")]
            {
                service
                    .as_mut()
                    .ok_or_else(|| unavailable.clone())?
                    .checkpoint_request(request)
                    .map_err(|error| {
                        unavailable.error = error;
                        unavailable
                    })
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, request);
                Err(unavailable)
            }
        })
        .await
        .map_err(|_| join_failure)?
    }

    async fn protect_import(
        &self,
        request: CheckpointRequest,
    ) -> Result<ImportProtectionReceipt, DocumentError> {
        let receipt = self
            .protect_workflow(WorkflowProtectionRequest {
                operation: WorkflowOperation::FountainImport,
                checkpoint: request,
            })
            .await?;
        Ok(ImportProtectionReceipt {
            checkpoint: receipt.checkpoint,
            revision: receipt.revision,
        })
    }

    async fn protect_workflow(
        &self,
        request: WorkflowProtectionRequest,
    ) -> Result<WorkflowProtectionReceipt, DocumentError> {
        let cost = payload_cost(
            request.checkpoint.version,
            &request.checkpoint.source,
            &request.checkpoint.source_sha256,
            &request.checkpoint.draft_metadata,
        )?;
        let permit = self.reserve(cost)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                service
                    .as_mut()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .protect_editor_workflow(request)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, request);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    async fn save(&self, request: SaveRequest) -> Result<SaveReceipt, Box<SaveFailure>> {
        let failure = |error| {
            Box::new(SaveFailure {
                identity: request.identity.clone(),
                version: request.version,
                error,
                replacement: ReplacementState::SourceUnchanged,
                recovery: None,
            })
        };
        let cost = payload_cost(
            request.version,
            &request.source,
            &request.source_sha256,
            &request.draft_metadata,
        )
        .map_err(|_| failure(DocumentError::new(ErrorCode::InvalidSave)))?;
        let permit = self.reserve(cost).map_err(failure)?;
        let unavailable = failure(DocumentError::new(ErrorCode::NativeUnavailable));
        let mut unknown = unavailable.clone();
        unknown.replacement = ReplacementState::OutcomeUnknown;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker.lock().map_err(|_| unknown_failure(&unavailable))?;
            #[cfg(target_os = "linux")]
            {
                let service = service.as_mut().ok_or_else(|| unavailable.clone())?;
                service.save_request(request)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, request);
                Err(unavailable)
            }
        })
        .await
        .map_err(|_| unknown)?
    }
}

fn unknown_failure(failure: &SaveFailure) -> Box<SaveFailure> {
    let mut failure = failure.clone();
    failure.replacement = ReplacementState::OutcomeUnknown;
    Box::new(failure)
}

#[tauri::command]
pub(super) async fn checkpoint_document(
    request: CheckpointRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<CheckpointReceipt, CheckpointFailure> {
    state.checkpoint(request).await
}
#[tauri::command]
pub(super) async fn save_document(
    request: SaveRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SaveReceipt, Box<SaveFailure>> {
    state.save(request).await
}

#[tauri::command]
pub(super) async fn protect_fountain_import(
    request: CheckpointRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<ImportProtectionReceipt, DocumentError> {
    state.protect_import(request).await
}

#[tauri::command]
pub(super) async fn protect_workflow(
    request: WorkflowProtectionRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<WorkflowProtectionReceipt, DocumentError> {
    state.protect_workflow(request).await
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use screenwriter_core::documents::{Ownership, recovery::source_hash};
    use std::{
        os::unix::fs::PermissionsExt,
        path::PathBuf,
        time::{Duration, Instant},
    };
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let base = std::env::var_os("BABEL_IPC_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let path = base.join(format!(
                "babel-worker-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir(&path).unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
            std::fs::write(path.join("source.fountain"), b"original").unwrap();
            std::fs::set_permissions(
                path.join("source.fountain"),
                std::fs::Permissions::from_mode(0o600),
            )
            .unwrap();
            Self(path)
        }
        fn host(&self) -> (DocumentHost, OpenDocument) {
            let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
            let opened = service
                .open_selected(&self.0.join("source.fountain"))
                .unwrap();
            assert_eq!(opened.ownership, Ownership::Exclusive);
            (
                DocumentHost {
                    service: Arc::new(Mutex::new(Some(service))),
                    ..Default::default()
                },
                opened,
            )
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }
    fn request(opened: &OpenDocument, version: u64, source: &[u8]) -> SaveRequest {
        SaveRequest {
            identity: opened.identity.clone(),
            version,
            source: source.to_vec(),
            source_sha256: source_hash(source),
            expected_fingerprint: opened.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({"unfinished":"character"}),
        }
    }
    fn until(mut condition: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !condition() {
            assert!(Instant::now() < deadline, "worker barrier timed out");
            std::thread::sleep(Duration::from_millis(1));
        }
    }
    #[test]
    fn budgets_bound_jobs_and_payload_and_release_on_completion() {
        let host = DocumentHost::default();
        let permits: Vec<_> = (0..8).map(|_| host.reserve(1).unwrap()).collect();
        assert_eq!(host.reserve(0).unwrap_err().code, ErrorCode::SaveQueueFull);
        drop(permits);
        let permit = host.reserve(MAX_QUEUED_BYTES).unwrap();
        assert!(host.reserve(1).is_err());
        drop(permit);
        assert_eq!(host.budget.lock().unwrap().jobs, 0);
        assert_eq!(host.budget.lock().unwrap().bytes, 0);
    }
    #[test]
    fn async_worker_waits_for_serial_writer_without_blocking_caller_thread() {
        let f = Fixture::new();
        let (host, opened) = f.host();
        let guard = host.service.lock().unwrap();
        let worker = host.clone();
        let req = request(&opened, 21, b"worker saved");
        let job = tauri::async_runtime::spawn(async move { worker.save(req).await });
        until(|| host.budget.lock().unwrap().jobs == 1);
        assert_eq!(app_info().name, "babel");
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"original"
        );
        drop(guard);
        let saved = tauri::async_runtime::block_on(job).unwrap().unwrap();
        assert_eq!(saved.version, 21);
        assert_eq!(host.budget.lock().unwrap().jobs, 0);
        assert_eq!(
            tauri::async_runtime::block_on(host.read_worker(opened.identity.clone())).unwrap(),
            opened
        );
    }
    #[test]
    fn cancelled_response_does_not_interrupt_started_native_save_or_block_raw_recovery() {
        let f = Fixture::new();
        let (host, opened) = f.host();
        let guard = host.service.lock().unwrap();
        let worker = host.clone();
        let req = request(&opened, 21, b"saved but response lost");
        let job = tauri::async_runtime::spawn(async move { worker.save(req).await });
        until(|| host.budget.lock().unwrap().jobs == 1);
        job.abort();
        assert!(tauri::async_runtime::block_on(job).is_err());
        drop(guard);
        until(|| host.budget.lock().unwrap().jobs == 0);
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"saved but response lost"
        );
        let next = b"newer raw writing";
        let receipt = tauri::async_runtime::block_on(host.checkpoint(CheckpointRequest {
            identity: opened.identity.clone(),
            version: 22,
            source: next.to_vec(),
            source_sha256: source_hash(next),
            expected_fingerprint: opened.fingerprint.clone(),
            draft_metadata: serde_json::json!({}),
        }))
        .unwrap();
        assert_eq!(receipt.version, 22);
        let state = host.service.lock().unwrap();
        let recovered = state
            .as_ref()
            .unwrap()
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap();
        assert_ne!(recovered.metadata.base_fingerprint, opened.fingerprint);
        assert_eq!(recovered.source, next);
    }
    #[test]
    fn poisoned_worker_reports_unknown_outcome_with_exact_identity_and_no_receipt() {
        let f = Fixture::new();
        let (host, opened) = f.host();
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = host.service.lock().unwrap();
            panic!("synthetic worker panic");
        }));
        let failure =
            tauri::async_runtime::block_on(host.save(request(&opened, 21, b"new"))).unwrap_err();
        assert_eq!(failure.identity, opened.identity);
        assert_eq!(failure.version, 21);
        assert_eq!(failure.replacement, ReplacementState::OutcomeUnknown);
        assert_eq!(failure.error.code, ErrorCode::NativeUnavailable);
        assert!(failure.recovery.is_none());
        assert_eq!(host.budget.lock().unwrap().jobs, 0);
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"original"
        );
    }
    #[test]
    fn ipc_save_cannot_consume_a_native_controllers_preexisting_queue_entry() {
        let f = Fixture::new();
        let (host, opened) = f.host();
        host.service
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .enqueue_save(request(&opened, 21, b"native queued"))
            .unwrap();
        let failure =
            tauri::async_runtime::block_on(host.save(request(&opened, 22, b"ipc requested")))
                .unwrap_err();
        assert_eq!(failure.error.code, ErrorCode::SaveQueueFull);
        assert_eq!(failure.version, 22);
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"original"
        );
        let saved = host
            .service
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .save_next(&opened.identity)
            .unwrap()
            .unwrap();
        assert_eq!(saved.version, 21);
    }

    #[test]
    fn risk_release_refuses_queued_work_and_relinquishes_only_the_exact_registration() {
        let f = Fixture::new();
        let (host, opened) = f.host();
        let mut wrong = opened.identity.clone();
        wrong.session_id = "11111111-1111-4111-8111-111111111111".to_string();
        assert_eq!(
            tauri::async_runtime::block_on(host.release_at_risk_worker(wrong))
                .unwrap_err()
                .code,
            ErrorCode::IdentityMismatch
        );
        host.service
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .enqueue_save(request(&opened, 21, b"queued writing"))
            .unwrap();
        assert_eq!(
            tauri::async_runtime::block_on(host.release_at_risk_worker(opened.identity.clone()))
                .unwrap_err()
                .code,
            ErrorCode::SaveNeedsAttention
        );
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"original"
        );
        host.service
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .save_next(&opened.identity)
            .unwrap()
            .unwrap();
        tauri::async_runtime::block_on(host.release_at_risk_worker(opened.identity.clone()))
            .unwrap();
        assert_eq!(
            tauri::async_runtime::block_on(host.read_worker(opened.identity.clone()))
                .unwrap_err()
                .code,
            ErrorCode::InvalidHandle
        );
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            b"queued writing"
        );
    }
}
