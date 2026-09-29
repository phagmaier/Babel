import { useEffect, useState } from 'react';
import type { AppInfoPort, AppInfoResult } from '../application/appInfo';
import { RecoveryReview } from './RecoveryReview';
import {
  unavailableRecovery,
  type RecoveryPort,
} from '../application/startupRecovery';
import { nativeRecovery } from '../infrastructure/nativeRecovery';
import { nativeDocumentEntry } from '../infrastructure/nativeDocumentEntry';
import { nativeDocuments } from '../infrastructure/nativeDocuments';
import { nativeSaveAs } from '../infrastructure/nativeSaveAs';
import { nativeSnapshots } from '../infrastructure/nativeSnapshots';
import { nativeRecoveryChoices } from '../infrastructure/nativeRecoveryChoices';
import { nativeFountainImport } from '../infrastructure/nativeFountainImport';
import { browserAppInfo } from '../infrastructure/browserAppInfo';
import { nativeAppInfo } from '../infrastructure/nativeAppInfo';
import {
  WritingView,
  type OpenRequest,
  type WritingPorts,
} from './WritingView';

const defaultPort =
  '__TAURI_INTERNALS__' in window ? nativeAppInfo : browserAppInfo;

const defaultRecovery =
  '__TAURI_INTERNALS__' in window ? nativeRecovery : unavailableRecovery;

const writingPorts = {
  entry: nativeDocumentEntry,
  documents: nativeDocuments,
  saveAs: nativeSaveAs,
  snapshots: nativeSnapshots,
  choices: nativeRecoveryChoices,
  recovery: nativeRecovery,
  fountainImport: nativeFountainImport,
};

export function App({
  appInfo = defaultPort,
  recovery = defaultRecovery,
  ports = writingPorts,
}: {
  appInfo?: AppInfoPort;
  recovery?: RecoveryPort;
  ports?: WritingPorts;
}) {
  const [result, setResult] = useState<AppInfoResult | null>(null);
  const [open, setOpen] = useState<OpenRequest | null>(null);
  const [openSequence, setOpenSequence] = useState(0);
  const native = '__TAURI_INTERNALS__' in window;

  useEffect(() => {
    if (!native || open) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.shiftKey) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setOpen({ kind: 'new' });
      } else if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setOpen({ kind: 'picked' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [native, open]);

  useEffect(() => {
    let active = true;
    void appInfo
      .getAppInfo()
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'unavailable',
            reason: 'Native app information could not be read.',
          });
      });
    return () => {
      active = false;
    };
  }, [appInfo]);

  if (open && native)
    return (
      <WritingView
        ports={ports}
        open={open}
        onSessionClosed={() => setOpen(null)}
        onOpenRequested={() => {
          setOpenSequence((n) => n + 1);
          setOpen({ kind: 'picked' });
        }}
        key={openSequence}
      />
    );

  return (
    <main className="shell">
      <div className="mark" aria-hidden="true">
        b
      </div>
      <p className="eyebrow">Local-first screenwriting · Safety foundation</p>
      <h1>babel</h1>
      <p className="subtitle">A place for stories to take shape.</p>
      <section aria-labelledby="status-heading" className="card">
        <h2 id="status-heading">Start writing</h2>
        <p>
          {native
            ? 'Create a recoverable draft or open a Fountain file to start writing.'
            : 'This build is for checking the desktop foundation. It cannot create, open, or save a screenplay yet.'}
        </p>
        <p className="status" role="status">
          {result === null
            ? 'Checking app information…'
            : result.status === 'ready'
              ? `${result.info.name} ${result.info.version} · native desktop host connected`
              : result.reason}
        </p>
      </section>
      <div className="actions" aria-label="Screenplay actions">
        <button
          type="button"
          disabled={!native}
          onClick={() => setOpen({ kind: 'new' })}
        >
          New screenplay{native ? '' : ' · coming later'}
        </button>
        <button
          type="button"
          disabled={!native}
          onClick={() => setOpen({ kind: 'picked' })}
        >
          Open Fountain{native ? '' : ' · coming later'}
        </button>
      </div>
      <RecoveryReview port={recovery} />
      <p className="footer">
        Recovery and source saving report their confirmed versions in the
        writing view.
      </p>
    </main>
  );
}
