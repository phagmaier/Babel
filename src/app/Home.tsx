import { useEffect, useRef, useState } from 'react';
import type { AppInfoResult } from '../application/appInfo';
import {
  RecentController,
  type RecentState,
} from '../application/recentController';
import type { RecentProjectsPort } from '../application/recentProjects';
import type { RecoveryPort } from '../application/startupRecovery';
import type { OpenRequest } from './WritingView';
import { RecoveryReview } from './RecoveryReview';

function localModification(seconds: number, nanos: number) {
  const date = new Date(seconds * 1000 + nanos / 1_000_000);
  return Number.isFinite(date.getTime()) ? (
    <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>
  ) : (
    'unavailable'
  );
}

export function Home({
  native,
  result,
  recents,
  recovery,
  onOpen,
  message = '',
}: {
  message?: string;
  native: boolean;
  result: AppInfoResult | null;
  recents: RecentProjectsPort;
  recovery: Pick<RecoveryPort, 'list' | 'preview'>;
  onOpen: (request: OpenRequest) => void;
}) {
  const controller = useRef<RecentController | null>(null);
  const [state, setState] = useState<RecentState>({
    catalog: null,
    loading: true,
    busy: false,
    message: '',
    selection: null,
  });
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    if (!native) return;
    const current = new RecentController(recents, setState);
    controller.current = current;
    void current.refresh();
    return () => {
      current.dispose();
      controller.current = null;
    };
  }, [native, recents]);
  useEffect(() => {
    if (!native) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        state.busy
      )
        return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onOpen({ kind: 'new' });
      } else if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        onOpen({ kind: 'picked' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [native, state.busy, onOpen]);
  const selection = state.selection;
  return (
    <main className="shell home">
      <div className="mark" aria-hidden="true">
        b
      </div>
      <p className="eyebrow">Local-first screenwriting</p>
      <h1>babel</h1>
      <p className="subtitle">A place for stories to take shape.</p>
      {message && <p role="status">{message}</p>}
      <section aria-labelledby="status-heading" className="card">
        <h2 id="status-heading">Start writing</h2>
        <p>
          {native
            ? 'Choose a source destination for a new screenplay, or start an unsaved draft protected by local recovery.'
            : 'Browser preview only. Native screenplay and storage services are unavailable.'}
        </p>
        <p className="status" role="status">
          {result === null
            ? 'Checking app information…'
            : result.status === 'ready'
              ? `${result.info.name} ${result.info.version} · native desktop host connected`
              : result.reason}
        </p>
        <div className="actions" aria-label="Screenplay actions">
          <button
            ref={first}
            type="button"
            disabled={!native || state.busy}
            onClick={() => onOpen({ kind: 'new' })}
          >
            New screenplay
          </button>
          <button
            type="button"
            disabled={!native || state.busy}
            onClick={() => onOpen({ kind: 'new', destination: true })}
          >
            New with destination
          </button>
          <button
            type="button"
            disabled={!native || state.busy}
            onClick={() => onOpen({ kind: 'picked' })}
          >
            Open Fountain
          </button>
        </div>
        <p>
          New screenplay starts an unsaved draft. Recovery protects confirmed
          versions on this device; it is not a separate backup.
        </p>
      </section>
      <section
        className="card recovery"
        aria-labelledby="recent-heading"
        aria-busy={native && (state.loading || state.busy)}
      >
        <h2 id="recent-heading">Recent screenplays</h2>
        {!native ? (
          <p>Recents require the native desktop app.</p>
        ) : (
          <>
            {state.loading && <p role="status">Reading recent metadata…</p>}
            {state.message && <p role="status">{state.message}</p>}
            {state.catalog?.health === 'needsAttention' && (
              <p role="alert">
                Recent metadata needs attention. Source saving and local
                recovery remain separate; use Open Fountain if a recent entry
                cannot be used.
              </p>
            )}
            {state.catalog?.entries.length === 0 && (
              <p>
                No recent screenplays yet. Unsaved drafts appear in local
                recovery below.
              </p>
            )}
            <ul className="recovery-list">
              {state.catalog?.entries.map((entry) => (
                <li key={entry.entryId}>
                  <h3>{entry.fileName}</h3>
                  <p>
                    Last known local modification:{' '}
                    {localModification(
                      entry.lastKnownModifiedSeconds,
                      entry.lastKnownModifiedNanos,
                    )}
                  </p>
                  <p>
                    {entry.kind === 'managed'
                      ? 'Managed project'
                      : 'Fountain file'}{' '}
                    ·{' '}
                    {entry.availability === 'missing'
                      ? 'Missing file — locate it explicitly'
                      : entry.availability === 'unknown'
                        ? 'Availability could not be checked'
                        : 'Available'}
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={
                        state.busy ||
                        state.loading ||
                        entry.availability === 'missing'
                      }
                      onClick={() =>
                        onOpen({ kind: 'recent', entryId: entry.entryId })
                      }
                    >
                      Open {entry.fileName}
                    </button>
                    <button
                      type="button"
                      disabled={state.busy || state.loading}
                      onClick={() =>
                        void controller.current?.locate(entry.entryId)
                      }
                    >
                      Locate {entry.fileName}
                    </button>
                    <button
                      type="button"
                      disabled={state.busy || state.loading}
                      onClick={() =>
                        void controller.current?.remove(entry.entryId)
                      }
                    >
                      Remove {entry.fileName} from Recents
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p>
              Remove from Recents removes metadata only. Your source and
              recovery stay on disk.
            </p>
            {selection && (
              <section
                className="recovery-preview"
                aria-labelledby="locate-heading"
              >
                <h3 id="locate-heading">
                  Confirm selected file: {selection.fileName}
                </h3>
                <p>
                  {selection.sameManagedIdentity
                    ? 'Managed project identity matches.'
                    : 'No matching managed identity was established.'}{' '}
                  {selection.contentMatchesLastKnown
                    ? 'Bytes match the last known source. Matching bytes alone do not establish identity.'
                    : 'Bytes differ from the last known source.'}
                </p>
                <p>
                  {selection.canLinkMoved
                    ? 'Link only if this is the moved screenplay. Linking keeps its recovery identity.'
                    : 'This selection cannot safely be linked as the moved screenplay.'}{' '}
                  Open as different preserves the old recent entry and recovery;
                  it may open read-only.
                </p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={!selection.canLinkMoved || state.busy}
                    onClick={() =>
                      onOpen({
                        kind: 'located',
                        selection,
                        choice: 'linkMoved',
                      })
                    }
                  >
                    Link moved screenplay
                  </button>
                  <button
                    type="button"
                    disabled={state.busy}
                    onClick={() =>
                      onOpen({
                        kind: 'located',
                        selection,
                        choice: 'openDifferent',
                      })
                    }
                  >
                    Open as different screenplay
                  </button>
                  <button
                    type="button"
                    onClick={() => controller.current?.cancelLocation()}
                  >
                    Cancel linking
                  </button>
                </div>
              </section>
            )}
            <button
              type="button"
              disabled={state.busy || state.loading}
              onClick={() => void controller.current?.refresh()}
            >
              Refresh Recents
            </button>
          </>
        )}
      </section>
      <RecoveryReview
        port={recovery}
        onResume={
          native && !state.busy
            ? (selection) => onOpen({ kind: 'recovered', selection })
            : undefined
        }
      />
    </main>
  );
}
