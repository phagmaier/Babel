import { useEffect, useRef, useState } from 'react';
import type {
  DiskFingerprint,
  DocumentIdentity,
  SaveReceipt,
} from '../application/documents';
import type { RecoverySelection } from '../application/startupRecovery';
import {
  sameFingerprint,
  type CopyReceipt,
  type RecoveryChoicesPort,
  type RecoveryComparison,
  type TransactionResolution,
} from '../application/recoveryChoices';

const transactions = {
  noTransaction: null,
  prepared:
    'A prepared save is waiting. It must be resolved before the source can be replaced.',
  installedCandidateUnconfirmed:
    'A replacement reached the file but was never confirmed. Resolve it before choosing.',
  confirmedRecordMatchesSource:
    'A confirmed replacement matches the file. Resolve it to finish the acknowledgement.',
  confirmedRecordDiverged:
    'The saved file differs from its last confirmed save. No interrupted save is waiting; choose which draft to use.',
  diverged:
    'The file changed outside this session. Both generations stay preserved; no direction is picked automatically.',
  needsAttention:
    'Saved material needs attention before any replacement. Nothing was discarded.',
} as const;

const sourceStates = {
  current: 'The source file is readable.',
  missing:
    'The source file is missing. Only an emergency copy remains available here; relinking belongs to a native file selection.',
  unreadable:
    'The source file could not be read safely. Only an emergency copy remains available here.',
} as const;

function validComparison(
  value: RecoveryComparison,
  identity: DocumentIdentity,
  selection: RecoverySelection,
): boolean {
  return (
    value.identity.handle === identity.handle &&
    value.identity.documentId === identity.documentId &&
    value.identity.sessionId === identity.sessionId &&
    value.selection.documentId === selection.documentId &&
    value.selection.origin === selection.origin &&
    value.selection.recordSha256 === selection.recordSha256 &&
    value.recovery.selection.documentId === selection.documentId &&
    Number.isInteger(value.recovery.version) &&
    Number.isInteger(value.recovery.generation) &&
    Number.isInteger(value.recovery.byteLength)
  );
}

export function RecoveryChoicePanel({
  port,
  identity,
  selection,
  expectedFingerprint,
  onRecovered,
  onKept,
  onInspectLater,
  readOnly = false,
  onResolved,
  nextVersion,
}: {
  port: RecoveryChoicesPort;
  identity: DocumentIdentity;
  selection: RecoverySelection;
  expectedFingerprint: DiskFingerprint;
  /** Adopted bytes must reach the editor through these callbacks; the panel never writes them itself. */
  onRecovered?: (receipt: SaveReceipt, selection: RecoverySelection) => void;
  onKept?: () => void;
  onInspectLater?: () => void;
  readOnly?: boolean;
  onResolved?: (resolution: TransactionResolution) => void;
  nextVersion?: number;
}) {
  const [comparison, setComparison] = useState<RecoveryComparison | null>(null);
  const [compareFailed, setCompareFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [newVersion, setNewVersion] = useState<number | null>(null);
  const [recovered, setRecovered] = useState<SaveReceipt | null>(null);
  const [kept, setKept] = useState(false);
  const [copied, setCopied] = useState<CopyReceipt | null>(null);
  const [resolved, setResolved] = useState<TransactionResolution | null>(null);
  const [actionFailed, setActionFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    const request = ++sequence.current;
    setComparison(null);
    setCompareFailed(false);
    setRecovered(null);
    setKept(false);
    setCopied(null);
    setResolved(null);
    setActionFailed(null);
    setBusy(false);
    void port.compare({ identity, selection }).then(
      (value) => {
        if (!active || request !== sequence.current) return;
        if (!validComparison(value, identity, selection)) {
          setCompareFailed(true);
          return;
        }
        setComparison(value);
        setNewVersion(value.recovery.version + 1);
      },
      () => {
        if (active && request === sequence.current) setCompareFailed(true);
      },
    );
    return () => {
      active = false;
      sequence.current += 1;
    };
    // Identity, selection and fingerprint are fixed for one mounted choice.
  }, [port, refresh]);

  async function act(
    label: string,
    run: () => Promise<
      SaveReceipt | CopyReceipt | TransactionResolution | RecoveryComparison
    >,
    apply: (
      value:
        SaveReceipt | CopyReceipt | TransactionResolution | RecoveryComparison,
    ) => void,
  ) {
    const request = ++sequence.current;
    setBusy(true);
    setActionFailed(null);
    try {
      const value = await run();
      if (request !== sequence.current) return;
      apply(value);
    } catch (error) {
      if (request !== sequence.current) return;
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : typeof error === 'object' && error !== null && 'error' in error
            ? String(
                (error as { error: { code?: unknown } }).error?.code ??
                  'unknown',
              )
            : 'unknown';
      setActionFailed(
        `${label} did not complete (${code}). Both generations remain preserved.`,
      );
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }

  if (compareFailed)
    return (
      <section className="card recovery" aria-labelledby="choice-heading">
        <h2 id="choice-heading">Source comparison unavailable</h2>
        <p>
          The source comparison could not be read safely. Refresh before
          choosing. Nothing was restored, copied or discarded.
        </p>
        <button type="button" onClick={() => setRefresh((n) => n + 1)}>
          Refresh comparison
        </button>
        {onInspectLater && (
          <button type="button" disabled={busy} onClick={onInspectLater}>
            Inspect later
          </button>
        )}
      </section>
    );
  if (!comparison)
    return (
      <section
        className="card recovery"
        aria-label="Source comparison"
        aria-live="polite"
      >
        Comparing recovery against the selected source…
      </section>
    );

  const staleFingerprint = !sameFingerprint(
    expectedFingerprint,
    comparison.source.fingerprint ?? expectedFingerprint,
  );
  const transactionNotice = transactions[comparison.transaction];
  const canAdopt =
    !busy &&
    !readOnly &&
    comparison.recovery.encoding === 'utf8' &&
    comparison.source.status === 'current' &&
    !comparison.externalDivergence &&
    !staleFingerprint &&
    (comparison.transaction === 'noTransaction' ||
      comparison.transaction === 'confirmedRecordMatchesSource' ||
      comparison.transaction === 'confirmedRecordDiverged');
  const targetVersion = nextVersion ?? newVersion;
  const versionReady =
    targetVersion !== null &&
    Number.isSafeInteger(targetVersion) &&
    targetVersion > comparison.recovery.version;

  return (
    <section className="card recovery" aria-labelledby="choice-heading">
      <h2 id="choice-heading">Recovery choice</h2>
      <p>
        {comparison.identical
          ? 'The recovered draft matches the saved file.'
          : 'A recovered draft differs from the saved file. Which draft do you want to use?'}
      </p>
      <details>
        <summary>Inspect recovery details</summary>
        <p>
          Recovery version {comparison.recovery.version}, generation{' '}
          {comparison.recovery.generation} · {comparison.recovery.byteLength}{' '}
          bytes. {sourceStates[comparison.source.status]}
        </p>
        <p className="hash">
          Recovery SHA-256: {comparison.recovery.sourceSha256}
        </p>
        {comparison.source.sourceSha256 && (
          <p className="hash">
            Source SHA-256: {comparison.source.sourceSha256}
          </p>
        )}
      </details>
      {comparison.identical && <p>Both generations hold identical content.</p>}
      {comparison.externalDivergence && (
        <p role="alert">
          The file changed outside this session. Both generations stay
          preserved; no direction is picked automatically.
        </p>
      )}
      {staleFingerprint && (
        <p role="alert">The comparison is stale. Refresh before choosing.</p>
      )}
      {transactionNotice && <p role="alert">{transactionNotice}</p>}
      {recovered && (
        <p role="status">
          Recovered as current, version {recovered.version}. The previous source
          copy and recovery checkpoints remain preserved.
        </p>
      )}
      {kept && (
        <p role="status">
          The current file was kept. Both generations remain preserved.
        </p>
      )}
      {copied && (
        <p role="status">
          Recovered copy saved as {copied.fileName}. The source and recovery
          remain unchanged.
        </p>
      )}
      {resolved && (
        <p role="status">
          {resolved.completed
            ? `An interrupted save was confirmed at version ${resolved.completed.version}. The previous source copy remains preserved.`
            : 'No interrupted save needed completion. All material remains preserved.'}
        </p>
      )}
      {actionFailed && <p role="alert">{actionFailed}</p>}
      {nextVersion === undefined && (
        <label>
          New source version
          <input
            type="number"
            min={comparison.recovery.version + 1}
            value={newVersion ?? ''}
            onChange={(event) =>
              setNewVersion(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
        </label>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={!canAdopt || !versionReady}
          onClick={() =>
            versionReady &&
            void act(
              'Recovery',
              () =>
                port.recover({
                  identity,
                  selection,
                  newVersion: targetVersion as number,
                  expectedFingerprint,
                }),
              (value) => {
                const receipt = value as SaveReceipt;
                setRecovered(receipt);
                onRecovered?.(receipt, selection);
              },
            )
          }
        >
          Restore recovered draft
        </button>
        <button
          type="button"
          disabled={
            busy ||
            readOnly ||
            comparison.source.status !== 'current' ||
            (comparison.transaction !== 'noTransaction' &&
              comparison.transaction !== 'confirmedRecordMatchesSource' &&
              comparison.transaction !== 'confirmedRecordDiverged')
          }
          onClick={() =>
            void act(
              'Keep',
              () => port.keep({ identity, selection, expectedFingerprint }),
              (value) => {
                const keptValue = value as RecoveryComparison;
                if (validComparison(keptValue, identity, selection)) {
                  setKept(true);
                  onKept?.();
                } else throw { code: 'recoveryNeedsAttention' };
              },
            )
          }
        >
          Keep saved file
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act(
              'Copy',
              () => port.copy({ identity, selection, expectedFingerprint }),
              (value) => setCopied(value as CopyReceipt),
            )
          }
        >
          Save Recovered Copy
        </button>
        {comparison.transaction !== 'noTransaction' &&
          comparison.transaction !== 'confirmedRecordDiverged' && (
            <button
              type="button"
              disabled={busy || readOnly}
              onClick={() =>
                void act(
                  'Resolve',
                  () => port.resolve(identity),
                  (value) => {
                    const resolution = value as TransactionResolution;
                    setResolved(resolution);
                    onResolved?.(resolution);
                  },
                )
              }
            >
              Resolve Interrupted Save
            </button>
          )}
        <button type="button" onClick={() => setRefresh((n) => n + 1)}>
          Refresh comparison
        </button>
      </div>
      {onInspectLater && (
        <button type="button" disabled={busy} onClick={onInspectLater}>
          Inspect later
        </button>
      )}
      <p>Both drafts stay preserved when you choose.</p>
    </section>
  );
}
