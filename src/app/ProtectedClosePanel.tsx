import { useEffect, useRef, useState } from 'react';
import type { ProtectedClose } from '../application/protectedClose';
import {
  destinationExplanation,
  type CopyDestination,
} from '../application/snapshots';

/** Mounted only with a live editor owner and native-selected copy destination. */
export function ProtectedClosePanel({
  close,
  destination,
  onClosed,
  statusToken,
  untitled = false,
  onCancel,
}: {
  close: ProtectedClose;
  destination?: CopyDestination;
  onClosed: () => void;
  statusToken?: string;
  untitled?: boolean;
  onCancel?: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  const [assessment, setAssessment] = useState(close.assessment);
  const [acceptRisk, setAcceptRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAcceptRisk(false);
    retryRef.current?.focus();
    return close.subscribe(setAssessment);
  }, [close]);
  useEffect(() => {
    setAcceptRisk(false);
    setAssessment(close.assessment);
  }, [close, statusToken]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setAssessment(close.assessment);
      if (close.assessment.phase === 'closed') onClosed();
    } catch {
      setAssessment(close.assessment);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="close-heading">
      <h2 id="close-heading">Close document safely</h2>
      {untitled && (
        <p>
          This draft has no Fountain file. Keep writing to use Save As, or close
          and keep its recovery draft. Recovery is not a separate backup.
        </p>
      )}
      <p role="status">
        {assessment.message ||
          'The latest version will be protected before close.'}
      </p>
      {assessment.phase === 'attention' && (
        <p role="alert">
          {assessment.onlyInMemory
            ? 'Newer changes exist only in memory. Closing now may lose them.'
            : assessment.sourceProtected
              ? 'The source is saved, but close could not be confirmed.'
              : 'The latest source is not confirmed saved. Recovery or a copy may still protect it.'}
        </p>
      )}
      <button
        ref={retryRef}
        type="button"
        disabled={busy || assessment.phase === 'closed'}
        onClick={() => void run(() => close.retry())}
      >
        {untitled && assessment.phase === 'editing'
          ? 'Close and keep recovery'
          : 'Retry save and close'}
      </button>
      {onCancel && (
        <button
          type="button"
          disabled={busy || assessment.phase === 'closed'}
          onClick={onCancel}
        >
          Keep writing
        </button>
      )}
      <button
        type="button"
        disabled={busy || !destination || assessment.phase === 'closed'}
        onClick={() =>
          destination &&
          void run(() => close.saveEmergencyCopy(destination.token))
        }
      >
        Save Emergency Copy and close
      </button>
      <p>
        If Fountain capture is unavailable, this saves a draft recovery bundle
        (.draft.json) with the live rows, styles, selection and exact original
        source. It is not a Fountain save.
      </p>
      {!destination && (
        <p>Select a destination natively to enable an emergency copy.</p>
      )}
      {destination && <p>{destinationExplanation(destination)}</p>}
      <label>
        <input
          type="checkbox"
          checked={acceptRisk}
          disabled={busy || assessment.phase === 'closed'}
          onChange={(event) => setAcceptRisk(event.target.checked)}
        />
        I understand that the latest changes may be lost if they exist only in
        memory.
      </label>
      <button
        type="button"
        disabled={busy || !acceptRisk || assessment.phase === 'closed'}
        onClick={() =>
          void run(() => close.acceptRisk(acceptRisk, assessment.liveVersion))
        }
      >
        Close with this risk
      </button>
    </section>
  );
}
