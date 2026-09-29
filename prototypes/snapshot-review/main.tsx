import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SnapshotPanel } from '../../src/app/SnapshotPanel';
import type {
  CheckpointRequest,
  OpenDocument,
} from '../../src/application/documents';
import type { CopyDestination } from '../../src/application/snapshots';
import { nativeSnapshots } from '../../src/infrastructure/nativeSnapshots';
import { nativeDocuments } from '../../src/infrastructure/nativeDocuments';
import '../../src/styles.css';
import './style.css';
async function sha(bytes: readonly number[]) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
async function report(event: string, detail: unknown) {
  await invoke('record_composition_proof', {
    report: JSON.stringify({
      task: 'M2-05C',
      event,
      nativeHost: '__TAURI_INTERNALS__' in window,
      userAgent: navigator.userAgent,
      detail,
    }),
  });
}
function Proof() {
  const [current, setCurrent] = useState<CheckpointRequest | null>(null);
  const [destination, setDestination] = useState<CopyDestination>();
  const [status, setStatus] = useState('Opening fixed synthetic LF fixture…');
  useEffect(() => {
    void (async () => {
      const opened = await invoke<OpenDocument>('open_composition_fixture', {
        fixture: 'lf',
      });
      const destination = await invoke<CopyDestination>(
        'select_snapshot_proof_destination',
        { request: opened.identity },
      );
      const current: CheckpointRequest = {
        identity: opened.identity,
        version: 21,
        source: opened.source,
        sourceSha256: await sha(opened.source),
        expectedFingerprint: opened.fingerprint,
        draftMetadata: { proof: 'M2-05C' },
      };
      setCurrent(current);
      setDestination(destination);
      setStatus(
        'Synthetic native source ready. F2 runs the snapshot/copy/restore/reopen drill.',
      );
      await report('ready', { current, destination });
    })().catch(() => setStatus('Native proof initialization failed.'));
  }, []);
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen('protected-close-requested', () => {
      if (!current) return;
      void nativeDocuments
        .release(current.identity)
        .then(() => getCurrentWindow().close())
        .catch(() => {
          if (active)
            setStatus(
              'Close stopped: native registration could not be released. Keep this synthetic root for inspection.',
            );
        });
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [current]);
  useEffect(() => {
    const run = async () => {
      if (!current || !current.expectedFingerprint || !destination) return;
      setStatus('Native drill running…');
      const edited = [
        ...current.source,
        ...new TextEncoder().encode('\n!Snapshot restore target.\n'),
      ];
      const entry = await nativeSnapshots.create({
        checkpoint: {
          ...current,
          version: 1,
          source: edited,
          sourceSha256: await sha(edited),
        },
        kind: 'named',
        name: 'Native synthetic snapshot',
      });
      if (!entry) throw new Error('Missing snapshot');
      const copied = await nativeSnapshots.copy({
        checkpoint: current,
        destinationToken: destination.token,
      });
      const live = [
        ...current.source,
        ...new TextEncoder().encode('\n!Unsaved local protection.\n'),
      ];
      const receipt = await nativeSnapshots.restore({
        current: { ...current, source: live, sourceSha256: await sha(live) },
        selection: entry.selection,
        newVersion: 22,
        expectedFingerprint: current.expectedFingerprint,
      });
      const catalog = await nativeSnapshots.prune(current.identity);
      await invoke('release_open_document', { request: current.identity });
      const reopened = await invoke<OpenDocument>('open_composition_fixture', {
        fixture: 'lf',
      });
      const preview = await nativeSnapshots.read({
        identity: reopened.identity,
        selection: entry.selection,
      });
      await report('completed', {
        entry,
        copied,
        receipt,
        catalog,
        reopened,
        preview,
      });
      setCurrent(null);
      setStatus(
        'Native snapshot, copy, protected restore and reopen completed; inspect independent disk audit.',
      );
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        void run().catch(async () => {
          setStatus(
            'Native drill failed; preserve the synthetic root for inspection.',
          );
          await report('failed', {});
        });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [current, destination]);
  return (
    <main className="shell snapshot-proof">
      <h1>M2-05C synthetic native snapshot proof</h1>
      <p role="status">{status}</p>
      {current && (
        <SnapshotPanel
          port={nativeSnapshots}
          current={current}
          destination={destination}
          onRestored={() =>
            setStatus(
              'Manual native restore completed; start a fresh synthetic root for another drill.',
            )
          }
        />
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Proof />);
