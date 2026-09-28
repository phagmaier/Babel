import { useEffect, useState } from 'react';
import type { AppInfoPort, AppInfoResult } from '../application/appInfo';
import { RecoveryReview } from './RecoveryReview';
import {
  unavailableRecovery,
  type RecoveryPort,
} from '../application/startupRecovery';
import { nativeRecovery } from '../infrastructure/nativeRecovery';
import { browserAppInfo } from '../infrastructure/browserAppInfo';
import { nativeAppInfo } from '../infrastructure/nativeAppInfo';

const defaultPort =
  '__TAURI_INTERNALS__' in window ? nativeAppInfo : browserAppInfo;

const defaultRecovery =
  '__TAURI_INTERNALS__' in window ? nativeRecovery : unavailableRecovery;

export function App({
  appInfo = defaultPort,
  recovery = defaultRecovery,
}: {
  appInfo?: AppInfoPort;
  recovery?: RecoveryPort;
}) {
  const [result, setResult] = useState<AppInfoResult | null>(null);

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

  return (
    <main className="shell">
      <div className="mark" aria-hidden="true">
        b
      </div>
      <p className="eyebrow">Local-first screenwriting · Safety foundation</p>
      <h1>babel</h1>
      <p className="subtitle">A place for stories to take shape.</p>
      <section aria-labelledby="status-heading" className="card">
        <h2 id="status-heading">Development skeleton</h2>
        <p>
          This build is for checking the desktop foundation. It cannot create,
          open, or save a screenplay yet.
        </p>
        <p className="status" role="status">
          {result === null
            ? 'Checking app information…'
            : result.status === 'ready'
              ? `${result.info.name} ${result.info.version} · native desktop host connected`
              : result.reason}
        </p>
      </section>
      <div className="actions" aria-label="Planned screenplay actions">
        <button disabled type="button">
          New screenplay · coming later
        </button>
        <button disabled type="button">
          Open Fountain · coming later
        </button>
      </div>
      <RecoveryReview port={recovery} />
      <p className="footer">
        Source opening, editing and recovery adoption will follow.
      </p>
    </main>
  );
}
