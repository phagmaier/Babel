//! Path-free recovery-choice commands. Blocking workers with bounded logical
//! budgets; cancellation never interrupts a started choice. Relinking stays
//! native-only: no IPC path exists, mirroring `open_selected`.
use super::*;
use screenwriter_core::documents::{
    MAX_SOURCE_BYTES,
    choices::{
        CompareRequest, CopyReceipt, CopyRequest, KeepRequest, RecoverRequest, RecoveryComparison,
        ResolveRequest, TransactionResolution,
    },
    saving::{ReplacementState, SaveFailure, SaveReceipt},
};

impl DocumentHost {
    async fn compare(&self, request: CompareRequest) -> Result<RecoveryComparison, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                service
                    .as_ref()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .compare_recovery(&request)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&service, request);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    async fn keep(&self, request: KeepRequest) -> Result<RecoveryComparison, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
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
                    .keep_current_source(&request)
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

    async fn copy(&self, request: CopyRequest) -> Result<CopyReceipt, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let service = worker
                .lock()
                .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?;
            #[cfg(target_os = "linux")]
            {
                service
                    .as_ref()
                    .ok_or_else(|| DocumentError::new(ErrorCode::NativeUnavailable))?
                    .save_recovered_copy(&request)
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = (&service, request);
                Err(DocumentError::new(ErrorCode::NativeUnavailable))
            }
        })
        .await
        .map_err(|_| DocumentError::new(ErrorCode::NativeUnavailable))?
    }

    async fn resolve(
        &self,
        request: ResolveRequest,
    ) -> Result<TransactionResolution, DocumentError> {
        let permit = self.reserve(MAX_SOURCE_BYTES)?;
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
                    .finalize_interrupted_save(&request)
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

    async fn recover(&self, request: RecoverRequest) -> Result<SaveReceipt, Box<SaveFailure>> {
        let failure = |error| {
            Box::new(SaveFailure {
                identity: request.identity.clone(),
                version: request.new_version,
                error,
                replacement: ReplacementState::SourceUnchanged,
                recovery: None,
            })
        };
        let permit = self.reserve(MAX_SOURCE_BYTES).map_err(failure)?;
        let unavailable = failure(DocumentError::new(ErrorCode::NativeUnavailable));
        let mut unknown = unavailable.clone();
        unknown.replacement = ReplacementState::OutcomeUnknown;
        let worker = self.service.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let mut service = worker.lock().map_err(|_| {
                let mut failure = unavailable.clone();
                failure.replacement = ReplacementState::OutcomeUnknown;
                failure
            })?;
            #[cfg(target_os = "linux")]
            {
                let service = service.as_mut().ok_or_else(|| unavailable.clone())?;
                service.recover_checkpoint_as_current(&request)
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

#[tauri::command]
pub(super) async fn compare_recovery(
    request: CompareRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryComparison, DocumentError> {
    state.compare(request).await
}

#[tauri::command]
pub(super) async fn recover_checkpoint_as_current(
    request: RecoverRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<SaveReceipt, Box<SaveFailure>> {
    state.recover(request).await
}

#[tauri::command]
pub(super) async fn keep_current_source(
    request: KeepRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<RecoveryComparison, DocumentError> {
    state.keep(request).await
}

#[tauri::command]
pub(super) async fn save_recovered_copy(
    request: CopyRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<CopyReceipt, DocumentError> {
    state.copy(request).await
}

#[tauri::command]
pub(super) async fn resolve_save_transaction(
    request: ResolveRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<TransactionResolution, DocumentError> {
    state.resolve(request).await
}
