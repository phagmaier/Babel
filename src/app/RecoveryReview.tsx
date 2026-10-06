import { useEffect, useRef, useState } from 'react';
import {
  displayPreview,
  sameSelection,
  type RecoveryCandidate,
  type RecoveryCatalog,
  type RecoveryNotice,
  type RecoveryPort,
  type RecoveryPreview,
  type RecoverySelection,
} from '../application/startupRecovery';

const notices: Record<RecoveryNotice, string> = {
  truncatedTail:
    'An interrupted tail was found. Earlier valid checkpoints remain available.',
  corruptTail:
    'A damaged tail was found. Earlier valid checkpoints remain available.',
  unsupportedSchema: 'A newer recovery format was found and left untouched.',
  tooLarge:
    'An artifact exceeds the supported recovery limits and was left untouched.',
  pending:
    'Pending checkpoints may come from an interrupted write; completion is unconfirmed.',
  quarantined: 'Quarantined recovery bytes remain preserved.',
  conflictingGeneration:
    'Different checkpoints claim the same generation. Both remain preserved.',
  unreadableArtifact:
    'An artifact could not be safely read. It remains untouched.',
};
/**
 * The version a writer most likely wants back: the newest confirmed checkpoint
 * (published or previous journal, never an unconfirmed pending write).
 */
export function latestCandidate(
  candidates: readonly RecoveryCandidate[],
): RecoveryCandidate | null {
  let best: RecoveryCandidate | null = null;
  for (const candidate of candidates) {
    const origin = candidate.selection.origin;
    if (origin !== 'current' && origin !== 'previous') continue;
    if (
      !best ||
      candidate.version > best.version ||
      (candidate.version === best.version && origin === 'current')
    )
      best = candidate;
  }
  return best;
}
const originNames = {
  current: 'Published journal',
  previous: 'Previous journal',
  pending: 'Pending write',
  previousPending: 'Pending previous journal',
};
export function RecoveryReview({
  port,
  onResume,
}: {
  port: Pick<RecoveryPort, 'list' | 'preview'>;
  onResume?: (selection: RecoverySelection) => void;
}) {
  const [catalog, setCatalog] = useState<RecoveryCatalog | null>(null);
  const [failure, setFailure] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [deferred, setDeferred] = useState(false);
  const [selected, setSelected] = useState<RecoveryCandidate | null>(null);
  const [preview, setPreview] = useState<ReturnType<
    typeof displayPreview
  > | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    sequence.current += 1;
    setCatalog(null);
    setFailure(false);
    setSelected(null);
    setPreview(null);
    setPreviewFailed(false);
    setDeferred(false);
    void port.list().then(
      (value) => {
        if (active) setCatalog(value);
      },
      () => {
        if (active) setFailure(true);
      },
    );
    return () => {
      active = false;
      sequence.current += 1;
    };
  }, [port, refresh]);

  async function inspect(candidate: RecoveryCandidate) {
    const request = ++sequence.current;
    setSelected(candidate);
    setPreview(null);
    setPreviewFailed(false);
    try {
      const result: RecoveryPreview = await port.preview({
        ...candidate.selection,
      });
      if (request !== sequence.current) return;
      if (
        !sameSelection(result.candidate.selection, candidate.selection) ||
        result.candidate.sourceSha256 !== candidate.sourceSha256 ||
        result.candidate.byteLength !== candidate.byteLength ||
        result.candidate.version !== candidate.version ||
        result.candidate.generation !== candidate.generation ||
        result.candidate.sessionId !== candidate.sessionId ||
        result.candidate.encoding !== candidate.encoding ||
        result.metadata.documentId !== candidate.selection.documentId ||
        result.metadata.sessionId !== candidate.sessionId ||
        result.metadata.version !== candidate.version ||
        result.metadata.generation !== candidate.generation ||
        result.metadata.sourceSha256 !== candidate.sourceSha256 ||
        result.source.length !== candidate.byteLength ||
        !result.source.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
      )
        throw new Error('Recovery selection changed');
      setPreview(displayPreview(result));
    } catch {
      if (request === sequence.current) setPreviewFailed(true);
    }
  }

  if (failure)
    return (
      <section className="card recovery" aria-labelledby="recovery-heading">
        <h2 id="recovery-heading">Recovery review unavailable</h2>
        <p>
          Local checkpoints could not be inspected. No recovery files were
          changed.
        </p>
        <button type="button" onClick={() => setRefresh((n) => n + 1)}>
          Retry recovery review
        </button>
      </section>
    );
  if (!catalog)
    return (
      <section
        className="card recovery"
        aria-label="Recovery review"
        aria-live="polite"
      >
        Checking local recovery checkpoints…
      </section>
    );
  if (deferred)
    return (
      <section className="card recovery" aria-labelledby="recovery-heading">
        <h2 id="recovery-heading">Recovery review deferred</h2>
        <p>
          All checkpoints remain on disk. No version was chosen or discarded.
        </p>
        <button type="button" onClick={() => setDeferred(false)}>
          Review checkpoints
        </button>
      </section>
    );
  return (
    <section className="card recovery" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">Local recovery review</h2>
      <p>
        This review covers private local checkpoints for loose files and unsaved
        drafts. Open a Fountain file to inspect its selected project or
        loose-file recovery and compare it with the current source.
      </p>
      <p>
        Inspection does not restore or save a screenplay. Local checkpoints may
        share a disk with your screenplay; they are not a separate backup.
      </p>
      {catalog.truncated && (
        <p role="alert">
          The scan reached its safety limit. This list is incomplete; remaining
          artifacts were left untouched.
        </p>
      )}
      {catalog.unrecognizedArtifacts > 0 && (
        <p role="alert">
          Unrecognized recovery artifacts were found and left untouched.
        </p>
      )}
      {catalog.entries.length === 0 && (
        <p>No recognized local checkpoints were found in this scan.</p>
      )}
      <ul className="recovery-list">
        {catalog.entries.map((entry) => {
          const latest = latestCandidate(entry.candidates);
          return (
            <li key={entry.documentId}>
              <h3>Draft {entry.documentId}</h3>
              {latest && (
                <div className="recovery-latest">
                  <p>
                    Work that was not closed normally. Open the latest version
                    to keep writing; every checkpoint below stays on disk.
                  </p>
                  {onResume && (
                    <button
                      type="button"
                      onClick={() => onResume({ ...latest.selection })}
                    >
                      Open latest version
                    </button>
                  )}
                </div>
              )}
              {entry.notices.map((notice) => (
                <p key={notice}>{notices[notice]}</p>
              ))}
              {entry.error && (
                <p>
                  Some recovery material needs attention. Refresh or inspect the
                  valid generations below.
                </p>
              )}
              {entry.candidates.length === 0 && (
                <p>
                  No valid checkpoint is available for preview; the original
                  artifacts remain protected.
                </p>
              )}
              <ul>
                {entry.candidates.map((candidate) => (
                  <li
                    key={`${candidate.selection.origin}-${candidate.selection.recordSha256}`}
                  >
                    <p>
                      {originNames[candidate.selection.origin]} · Version{' '}
                      {candidate.version}, generation {candidate.generation} ·{' '}
                      {candidate.byteLength} bytes
                    </p>
                    <p className="hash">
                      Source SHA-256: {candidate.sourceSha256}
                    </p>
                    <button
                      type="button"
                      onClick={() => void inspect(candidate)}
                    >
                      Inspect{' '}
                      {originNames[candidate.selection.origin].toLowerCase()}{' '}
                      generation {candidate.generation}
                    </button>
                    {onResume && (
                      <button
                        type="button"
                        aria-label={`Resume as new draft · ${originNames[candidate.selection.origin]} generation ${candidate.generation}, version ${candidate.version}`}
                        onClick={() => onResume({ ...candidate.selection })}
                      >
                        Resume as new draft
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {selected && (
        <section
          className="recovery-preview"
          aria-labelledby="preview-heading"
          aria-live="polite"
        >
          <h3 id="preview-heading">
            Read-only checkpoint preview · Generation {selected.generation}
          </h3>
          {previewFailed ? (
            <p role="alert">
              This checkpoint changed or could not be read safely. Refresh the
              list before inspecting it again.
            </p>
          ) : !preview ? (
            <p>Reading selected checkpoint…</p>
          ) : (
            <>
              {preview.hex && (
                <p>
                  The checkpoint is not valid UTF-8. Raw bytes are shown in
                  hexadecimal; no text was converted or replaced.
                </p>
              )}
              {preview.truncated && (
                <p>
                  Only the beginning is shown. The full {selected.byteLength}
                  -byte checkpoint remains on disk.
                </p>
              )}
              <pre tabIndex={0}>{preview.text}</pre>
            </>
          )}
        </section>
      )}
      <p>
        Recover as Current, Save Recovered Copy, and Keep Current File run
        through explicit native comparison once a source is natively selected.
        Open a screenplay to compare its live source here.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            sequence.current += 1;
            setSelected(null);
            setPreview(null);
            setDeferred(true);
          }}
        >
          Inspect Later
        </button>
        <button type="button" onClick={() => setRefresh((n) => n + 1)}>
          Refresh recovery list
        </button>
      </div>
    </section>
  );
}
