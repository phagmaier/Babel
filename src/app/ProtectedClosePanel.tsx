import { useEffect, useState } from 'react';
import type { ProtectedClose } from '../application/protectedClose';
import type { CopyDestination } from '../application/snapshots';

/** Mounted only with a live editor owner and native-selected copy destination. */
export function ProtectedClosePanel({
  close,
  destination,
  onClosed,
}: {
  close: ProtectedClose;
  destination?: CopyDestination;
  onClosed: () => void;
}) {
  const [assessment, setAssessment] = useState(close.assessment);
  const [acceptRisk, setAcceptRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAcceptRisk(false);
    return close.subscribe(setAssessment);
  }, [close]);
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
        type="button"
        disabled={busy || assessment.phase === 'closed'}
        onClick={() => void run(() => close.retry())}
      >
        Retry save and close
      </button>
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
      {!destination && (
        <p>Select a destination natively to enable an emergency copy.</p>
      )}
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
        onClick={() => void run(() => close.acceptRisk(acceptRisk))}
      >
        Close with this risk
      </button>
    </section>
  );
}
