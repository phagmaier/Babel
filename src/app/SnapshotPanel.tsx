import { useEffect, useRef, useState } from 'react';
import './snapshots.css';
import type { CheckpointRequest, SaveReceipt } from '../application/documents';
import { sameIdentity } from '../application/persistenceState';
import {
  destinationExplanation,
  snapshotPolicy,
  type CopyDestination,
  type SnapshotCatalog,
  type SnapshotPort,
  type SnapshotSelection,
} from '../application/snapshots';
/** Current-session snapshot controls; all paths and publication remain native. */
export function SnapshotPanel({
  port,
  current,
  destination,
  onRestored,
  nextVersion,
}: {
  port: SnapshotPort;
  current: CheckpointRequest;
  destination?: CopyDestination;
  onRestored: (receipt: SaveReceipt, selection: SnapshotSelection) => void;
  nextVersion?: number;
}) {
  const targetVersion = nextVersion;
  const [catalog, setCatalog] = useState<SnapshotCatalog | null>(null);
  const [name, setName] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const restoreVersion = targetVersion ?? Number(newVersion);
  const sequence = useRef(0);
  useEffect(() => {
    const ticket = ++sequence.current;
    setCatalog(null);
    setBusy(false);
    setMessage('');
    void port
      .list(current.identity)
      .then((value) => {
        if (ticket === sequence.current) setCatalog(value);
      })
      .catch(() => {
        if (ticket === sequence.current)
          setMessage('Snapshots could not be read. Refresh to retry.');
      });
    return () => {
      sequence.current++;
    };
  }, [port, current.identity.handle, current.identity.sessionId, refresh]);
  async function run(operation: (isCurrent: () => boolean) => Promise<string>) {
    const ticket = ++sequence.current;
    setBusy(true);
    setMessage('');
    try {
      const value = await operation(() => ticket === sequence.current);
      if (ticket === sequence.current) {
        setMessage(value);
        void port
          .list(current.identity)
          .then((catalog) => {
            if (ticket === sequence.current) setCatalog(catalog);
          })
          .catch(() => {
            if (ticket === sequence.current)
              setMessage(`${value} Snapshot list could not be refreshed.`);
          });
      }
    } catch {
      if (ticket === sequence.current)
        setMessage(
          'Protection failed or its result could not be confirmed. Existing source and recovery status remain separate. Retry or choose another copy destination.',
        );
    } finally {
      if (ticket === sequence.current) setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="snapshots-heading"
      className="card snapshot-panel"
    >
      <h2 id="snapshots-heading">Snapshots and backup copies</h2>
      <p>{snapshotPolicy}</p>
      <p>
        Local snapshots and history can share the source disk. They do not
        protect against losing that disk.
      </p>
      {catalog?.needsAttention && (
        <p role="alert">
          Interrupted or damaged snapshot material needs inspection. Pruning is
          blocked; existing material stays preserved.
        </p>
      )}
      {catalog?.atLimit && (
        <p role="alert">
          The snapshot limit has been reached. Protected versions will not be
          removed automatically.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setRefresh((n) => n + 1)}
      >
        Refresh snapshots
      </button>
      <label>
        Snapshot name
        <input
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={
          busy ||
          !name.trim() ||
          catalog === null ||
          catalog.needsAttention ||
          catalog.atLimit
        }
        onClick={() =>
          void run(async () => {
            const entry = await port.create({
              checkpoint: current,
              kind: 'named',
              name,
            });
            if (
              !entry ||
              entry.record.documentId !== current.identity.documentId ||
              entry.record.sessionId !== current.identity.sessionId ||
              entry.record.version !== current.version ||
              entry.record.sourceSha256 !== current.sourceSha256 ||
              entry.record.byteLength !== current.source.length ||
              entry.record.kind !== 'named' ||
              entry.record.name !== name
            )
              throw new Error('Unconfirmed snapshot');
            return `Named snapshot protected for version ${current.version}.`;
          })
        }
      >
        Keep named snapshot
      </button>
      {nextVersion === undefined && (
        <label>
          New restore version
          <input
            value={newVersion}
            inputMode="numeric"
            onChange={(e) => setNewVersion(e.target.value)}
          />
        </label>
      )}
      <ul>
        {catalog?.entries.map((entry) => (
          <li key={entry.record.snapshotId}>
            {entry.record.name ??
              (entry.record.kind === 'preDestructive'
                ? 'Before replacement'
                : 'Rolling snapshot')}{' '}
            · {entry.record.byteLength} bytes
            <button
              type="button"
              disabled={
                busy ||
                !current.expectedFingerprint ||
                catalog.needsAttention ||
                !Number.isSafeInteger(restoreVersion) ||
                restoreVersion <= current.version
              }
              onClick={() =>
                void run(async (isCurrent) => {
                  if (!current.expectedFingerprint)
                    throw new Error('Missing source');
                  const receipt = await port.restore({
                    current,
                    selection: entry.selection,
                    newVersion: restoreVersion,
                    expectedFingerprint: current.expectedFingerprint,
                  });
                  if (
                    !sameIdentity(receipt.identity, current.identity) ||
                    (nextVersion === undefined
                      ? receipt.version !== restoreVersion
                      : receipt.version < restoreVersion) ||
                    receipt.sourceSha256 !== entry.record.sourceSha256 ||
                    receipt.protection !== 'sourceFile' ||
                    receipt.fingerprint.sha256 !== entry.record.sourceSha256 ||
                    receipt.fingerprint.byteLength !==
                      entry.record.byteLength ||
                    !sameIdentity(
                      receipt.recovery.identity,
                      current.identity,
                    ) ||
                    receipt.recovery.version !== receipt.version ||
                    receipt.recovery.sourceSha256 !== receipt.sourceSha256 ||
                    receipt.recovery.protection !== 'recoveryCheckpoint'
                  )
                    throw new Error('Unconfirmed restore');
                  if (isCurrent()) onRestored(receipt, entry.selection);
                  return `Restored as new version ${receipt.version}; previous versions remain protected.`;
                })
              }
            >
              Restore previous version
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || !catalog || catalog.needsAttention}
        onClick={() =>
          void run(async () => {
            const value = await port.prune(current.identity);
            if (value.needsAttention) throw new Error('Needs inspection');
            return 'Retention completed; named and pre-destructive versions remain protected.';
          })
        }
      >
        Apply retention
      </button>
      {destination ? (
        <p>{destinationExplanation(destination)}</p>
      ) : (
        <p>
          Select another folder or drive through the native controller to save a
          copy. The writing view offers destination selection before copies.
        </p>
      )}
      <button
        type="button"
        disabled={busy || !destination}
        onClick={() =>
          void run(async () => {
            if (!destination) throw new Error('Missing destination');
            const receipt = await port.copy({
              checkpoint: current,
              destinationToken: destination.token,
            });
            if (
              !sameIdentity(receipt.identity, current.identity) ||
              receipt.version !== current.version ||
              receipt.sourceSha256 !== current.sourceSha256 ||
              receipt.byteLength !== current.source.length ||
              receipt.storageRelation !== destination.storageRelation
            )
              throw new Error('Unconfirmed copy');
            return `Copy verified for version ${receipt.version}. Source-file and recovery status are unchanged.`;
          })
        }
      >
        Save copy to selected destination
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
