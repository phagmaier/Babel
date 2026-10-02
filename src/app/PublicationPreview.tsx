import { useEffect, useRef, useState } from 'react';
import type {
  PreviewArtifact,
  PublicationPreviewController,
  PublicationPreviewState,
} from '../application/publicationPreview';
export interface PdfDocumentView {
  readonly pages: number;
  render(
    page: number,
    zoom: number,
    host: HTMLElement,
    signal: AbortSignal,
  ): Promise<string>;
  close(): void;
}
export interface PdfViewerPort {
  load(bytes: Uint8Array, signal: AbortSignal): Promise<PdfDocumentView>;
}
const bundledViewer: PdfViewerPort = {
  load: async (bytes, signal) =>
    (await import('../infrastructure/localPdfViewer')).localPdfViewer.load(
      bytes,
      signal,
    ),
};
export function PublicationPreview({
  controller,
  state,
  onClose,
  viewer = bundledViewer,
}: {
  controller: PublicationPreviewController;
  state: PublicationPreviewState;
  onClose: () => void;
  viewer?: PdfViewerPort;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
  }, []);
  return (
    <section
      className="publication-preview"
      aria-label="Read-only PDF preview"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <h2>Read-only PDF preview</h2>
      <p role="status" aria-live="polite">
        {state.message}
      </p>
      <p>
        US Letter · Courier Prime · printed pages. Editing and Save remain
        available.
      </p>
      <button type="button" ref={closeButton} onClick={onClose}>
        Close PDF preview
      </button>
      <button
        type="button"
        onClick={() => controller.refresh()}
        disabled={state.phase === 'updating'}
      >
        Refresh PDF preview
      </button>
      {state.artifact && (
        <>
          <p>
            Captured version {state.artifact.result.version}
            {state.phase !== 'ready' ? ' · preview is not current' : ''}
          </p>
          {state.artifact.result.warnings.length > 0 && (
            <p role="note">
              Publication limitations:{' '}
              {state.artifact.result.warnings.map((w) => w.message).join(' ')}{' '}
              Run Script Check before export.
            </p>
          )}
          <PdfPages
            key={state.artifact.result.artifact}
            artifact={state.artifact}
            controller={controller}
            viewer={viewer}
          />
        </>
      )}
    </section>
  );
}
function PdfPages({
  artifact,
  controller,
  viewer,
}: {
  artifact: PreviewArtifact;
  controller: PublicationPreviewController;
  viewer: PdfViewerPort;
}) {
  const [pdf, setPdf] = useState<PdfDocumentView | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    let document: PdfDocumentView | null = null;
    void viewer
      .load(artifact.bytes, abort.signal)
      .then((value) => {
        document = value;
        if (abort.signal.aborted) {
          value.close();
          return;
        }
        if (value.pages !== artifact.result.pageCount) {
          setFailed(true);
          controller.displayed(artifact, value.pages);
          value.close();
          return;
        }
        setPdf(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setFailed(true);
          controller.displayFailed(artifact);
        }
      });
    return () => {
      abort.abort();
      document?.close();
    };
  }, [artifact, controller, viewer]);
  useEffect(() => {
    if (!pdf || !host.current) return;
    const abort = new AbortController();
    // React state updates happen asynchronously, not in an input handler.
    void (async () => {
      setBusy(true);
      setText('');
      try {
        const text = await pdf.render(page, zoom, host.current!, abort.signal);
        if (!abort.signal.aborted) {
          setText(text);
          setBusy(false);
          controller.displayed(artifact, pdf.pages);
        }
      } catch {
        if (!abort.signal.aborted) {
          setBusy(false);
          setFailed(true);
          controller.displayFailed(artifact);
        }
      }
    })();
    return () => abort.abort();
  }, [pdf, page, zoom, artifact, controller]);
  return (
    <div aria-busy={busy && !failed}>
      <div className="pdf-page-controls">
        <button
          type="button"
          disabled={!pdf || page <= 1}
          onClick={() => setPage((n) => n - 1)}
        >
          Previous PDF page
        </button>
        <span>
          Page {page} of {artifact.result.pageCount}
        </span>
        <button
          type="button"
          disabled={!pdf || page >= pdf.pages}
          onClick={() => setPage((n) => n + 1)}
        >
          Next PDF page
        </button>
        <label>
          PDF zoom{' '}
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </label>
      </div>
      {failed ? (
        <p role="alert">PDF page display unavailable.</p>
      ) : (
        busy && <p>Displaying PDF page…</p>
      )}
      <div
        ref={host}
        className="pdf-page"
        tabIndex={0}
        aria-label="PDF page viewport"
      />
      <details>
        <summary>Read-only PDF page text</summary>
        <pre tabIndex={0}>{text}</pre>
      </details>
    </div>
  );
}
