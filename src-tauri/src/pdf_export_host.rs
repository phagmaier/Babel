//! Export authorities use the preview's renderer and artifact lock. No IPC paths.
use super::*;
use screenwriter_core::documents::{pdf::*, persistence::payload_cost};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExportRenderRequest {
    identity: DocumentRequest,
    capture_token: String,
    request_id: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExportPublishRequest {
    identity: DocumentRequest,
    capture_token: String,
    destination_token: String,
    request_id: u64,
    artifact: String,
    acknowledged: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportReceipt {
    publication: PdfPublicationReceipt,
    result: RenderResult,
}
fn unavailable() -> DocumentError {
    DocumentError::new(ErrorCode::NativeUnavailable)
}
fn invalid() -> DocumentError {
    DocumentError::new(ErrorCode::InvalidDestination)
}

#[tauri::command]
pub async fn prepare_pdf_capture(
    request: PreparePdfRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<PdfCaptureReceipt, DocumentError> {
    let cp = &request.checkpoint;
    payload_cost(
        cp.version,
        &cp.source,
        &cp.source_sha256,
        &cp.draft_metadata,
    )?;
    #[cfg(target_os = "linux")]
    return state
        .document_worker(MAX_SOURCE_BYTES, move |s| {
            s.prepare_pdf_capture(&request.checkpoint)
        })
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        state.document_worker(MAX_SOURCE_BYTES, ()).await
    }
}
#[cfg(test)]
fn pick_pdf() -> Option<PathBuf> {
    None
}
#[cfg(not(test))]
fn pick_pdf() -> Option<PathBuf> {
    file_dialog()
        .set_title("Export PDF")
        .add_filter("PDF screenplay", &["pdf"])
        .set_file_name("Untitled.pdf")
        .save_file()
}
#[tauri::command]
pub async fn select_pdf_destination(
    request: PdfCaptureRequest,
    state: tauri::State<'_, DocumentHost>,
) -> Result<Option<PdfTarget>, DocumentError> {
    let permit = state.reserve(0)?;
    let documents = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        #[cfg(target_os = "linux")]
        {
            documents
                .service
                .lock()
                .map_err(|_| unavailable())?
                .as_ref()
                .ok_or_else(unavailable)?
                .pdf_capture(&request.identity, &request.capture_token)?;
            let Some(path) = pick_pdf() else {
                return Ok(None);
            };
            documents
                .service
                .lock()
                .map_err(|_| unavailable())?
                .as_mut()
                .ok_or_else(unavailable)?
                .select_pdf_destination(&request.identity, &request.capture_token, &path)
                .map(Some)
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (documents, request);
            Err(unavailable())
        }
    })
    .await
    .map_err(|_| unavailable())?
}
#[tauri::command]
pub async fn render_pdf_export(
    request: ExportRenderRequest,
    documents: tauri::State<'_, DocumentHost>,
    state: tauri::State<'_, PublicationHost>,
) -> Result<RenderResult, PublicationError> {
    let permit = documents
        .reserve(MAX_SOURCE_BYTES)
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
            {
                let cp = service
                    .as_ref()
                    .ok_or(PublicationError::InvalidIdentity)?
                    .pdf_capture(&request.identity, &request.capture_token)
                    .map_err(|_| PublicationError::InvalidIdentity)?;
                assessment::assessment_identity(&host.get()?.runtime)?;
                host.submit(RenderRequest {
                    identity: request.identity.clone(),
                    request_id: request.request_id,
                    version: cp.version,
                    source: cp.source,
                    source_sha256: cp.source_sha256,
                    profile: PROFILE.into(),
                    font_set: FONT_SET.into(),
                    options: RenderOptions {},
                })?
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = &service;
                return Err(PublicationError::RendererUnavailable);
            }
        };
        let result = receiver.recv().map_err(|_| PublicationError::Internal)??;
        let inner = host.get()?;
        let mut q = inner.queue.lock().map_err(|_| PublicationError::Internal)?;
        if q.artifact.as_ref().is_none_or(|(identity, path)| {
            *identity != result.identity
                || path.file_stem().and_then(|s| s.to_str()) != Some(result.artifact.as_str())
        }) || q
            .latest
            .get(&result.identity.handle)
            .is_none_or(|entry| entry.0 != result.request_id)
        {
            return Err(PublicationError::Cancelled);
        }
        let bytes = read_locked(
            &q,
            &ReadPublicationRequest {
                identity: result.identity.clone(),
                request_id: result.request_id,
                artifact: result.artifact.clone(),
            },
        )?;
        q.export_artifact = Some((request.capture_token, result.clone(), source_hash(&bytes)));
        Ok(result)
    })
    .await
    .map_err(|_| PublicationError::Internal)?
}
#[tauri::command]
pub async fn publish_pdf_export(
    request: ExportPublishRequest,
    documents: tauri::State<'_, DocumentHost>,
    state: tauri::State<'_, PublicationHost>,
) -> Result<ExportReceipt, DocumentError> {
    if !request.acknowledged {
        return Err(invalid());
    }
    let permit = documents.reserve(0)?;
    let documents = documents.inner().clone();
    let host = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let mut service = documents.service.lock().map_err(|_| unavailable())?;
        #[cfg(target_os = "linux")]
        {
            let service = service.as_mut().ok_or_else(unavailable)?;
            let cp = service.pdf_capture(&request.identity, &request.capture_token)?;
            let inner = host.get().map_err(|_| unavailable())?;
            assessment::assessment_identity(&inner.runtime).map_err(|_| unavailable())?;
            // Hold admission/cancel lock throughout publication; typing checkpoints
            // remain independent, and no obsolete artifact can replace a destination.
            let q = inner.queue.lock().map_err(|_| unavailable())?;
            let (token, result, pdf_sha256) = q.export_artifact.as_ref().ok_or_else(invalid)?;
            if *token != request.capture_token
                || result.identity != request.identity
                || result.request_id != request.request_id
                || result.artifact != request.artifact
                || result.version != cp.version
                || result.source_sha256 != cp.source_sha256
            {
                return Err(invalid());
            }
            let bytes = read_locked(
                &q,
                &ReadPublicationRequest {
                    identity: request.identity,
                    request_id: request.request_id,
                    artifact: request.artifact,
                },
            )
            .map_err(|_| invalid())?;
            if source_hash(&bytes) != *pdf_sha256 {
                return Err(invalid());
            }
            let publication =
                service.publish_pdf(&result.identity, token, &request.destination_token, &bytes)?;
            Ok(ExportReceipt {
                publication,
                result: result.clone(),
            })
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (&mut service, host, request);
            Err(unavailable())
        }
    })
    .await
    .map_err(|_| unavailable())?
}
#[tauri::command]
pub async fn cancel_pdf_export(
    request: PdfCaptureRequest,
    documents: tauri::State<'_, DocumentHost>,
) -> Result<(), DocumentError> {
    #[cfg(target_os = "linux")]
    return documents
        .document_worker(0, move |s| {
            s.cancel_pdf_capture(&request.identity, &request.capture_token)
        })
        .await;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = request;
        documents.document_worker(0, ()).await
    }
}
