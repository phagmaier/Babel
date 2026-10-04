//! Shared bounded DocumentError workers; picker and save-failure paths stay local.
use super::*;

impl DocumentHost {
    pub(super) async fn document_worker<T: Send + 'static>(
        &self,
        cost: usize,
        #[cfg(target_os = "linux")] operation: impl FnOnce(
            &mut DocumentService,
        ) -> Result<T, DocumentError>
        + Send
        + 'static,
        #[cfg(not(target_os = "linux"))] operation: impl Send + 'static,
    ) -> Result<T, DocumentError> {
        let permit = self.reserve(cost)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                operation(
                    service
                        .as_mut()
                        .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?,
                )
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&mut service, operation);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use crate::test_support::TestRoot;
    use screenwriter_core::documents::saving::{MAX_QUEUED_BYTES, MAX_QUEUED_SAVES};
    use std::sync::atomic::{AtomicBool, Ordering};

    fn budget_released(host: &DocumentHost) {
        let mut permits = vec![host.reserve(MAX_QUEUED_BYTES).unwrap()];
        for _ in 1..MAX_QUEUED_SAVES {
            permits.push(host.reserve(0).unwrap());
        }
        assert_eq!(host.reserve(0).unwrap_err().code, ErrorCode::SaveQueueFull);
        drop(permits);
    }
    #[test]
    fn worker_preserves_absent_poison_and_join_failure_mapping_and_releases_budget() {
        let host = DocumentHost::default();
        let result: Result<(), _> =
            tauri::async_runtime::block_on(host.document_worker(17, |_| Ok(())));
        assert_eq!(result.unwrap_err().code, ErrorCode::NativeUnavailable);
        budget_released(&host);
        let poison = host.service.clone();
        assert!(
            std::thread::spawn(move || {
                let _guard = poison.lock().unwrap();
                panic!("injected poison");
            })
            .join()
            .is_err()
        );
        let result: Result<(), _> =
            tauri::async_runtime::block_on(host.document_worker(17, |_| Ok(())));
        assert_eq!(result.unwrap_err().code, ErrorCode::NativeUnavailable);
        budget_released(&host);

        let root = TestRoot::new("BABEL_IPC_TEST_ROOT", "babel-worker-join");
        let host = DocumentHost {
            service: Arc::new(Mutex::new(Some(
                DocumentService::new(&root.join("store")).unwrap(),
            ))),
            ..Default::default()
        };
        let result: Result<(), _> = tauri::async_runtime::block_on(
            host.document_worker(17, |_| panic!("injected join panic")),
        );
        assert_eq!(result.unwrap_err().code, ErrorCode::NativeUnavailable);
        budget_released(&host);
    }
    #[test]
    fn worker_keeps_exact_cost_and_never_calls_operation_after_reservation_refusal() {
        let host = DocumentHost::default();
        let called = Arc::new(AtomicBool::new(false));
        let marker = called.clone();
        let result: Result<(), _> =
            tauri::async_runtime::block_on(host.document_worker(MAX_QUEUED_BYTES + 1, move |_| {
                marker.store(true, Ordering::SeqCst);
                Ok(())
            }));
        assert_eq!(result.unwrap_err().code, ErrorCode::SaveQueueFull);
        assert!(!called.load(Ordering::SeqCst));
        budget_released(&host);
    }
    #[test]
    fn worker_returns_core_success_and_errors_without_losing_service_or_budget() {
        let root = TestRoot::new("BABEL_IPC_TEST_ROOT", "babel-worker-results");
        let host = DocumentHost {
            service: Arc::new(Mutex::new(Some(
                DocumentService::new(&root.join("store")).unwrap(),
            ))),
            ..Default::default()
        };
        let opened = tauri::async_runtime::block_on(
            host.document_worker(0, |service| service.register_unsaved()),
        )
        .unwrap();
        assert!(opened.source.is_empty());
        let result: Result<(), _> = tauri::async_runtime::block_on(
            host.document_worker(17, |_| Err(DocumentError::new(ErrorCode::SourceChanged))),
        );
        assert_eq!(
            result.unwrap_err(),
            DocumentError::new(ErrorCode::SourceChanged)
        );
        budget_released(&host);
    }
}
