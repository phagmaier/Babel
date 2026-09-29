/**
 * M3-12 production writing surface. One WritingSession binds the mounted
 * editor to native persistence; startup recovery, explicit choices,
 * snapshots/emergency copies and protected close all act on the current
 * editor through the session — never around it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './writing.css';
import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { EditorCaptureBoundary } from '../application/editorCapture';
import type { CapturedSnapshot } from '../application/persistenceController';
import type { DocumentEntryPort } from '../application/documentEntry';
import type { DocumentPort } from '../application/documents';
import type { FountainImportPort } from '../application/fountainImport';
import { FountainImportBoundary } from '../application/fountainImport';
import type { RecoveryChoicesPort } from '../application/recoveryChoices';
import type {
  RecoveryCandidate,
  RecoveryPort,
} from '../application/startupRecovery';
import type { SaveAsPort } from '../application/saveAs';
import type { CopyDestination, SnapshotPort } from '../application/snapshots';
import {
  WritingSession,
  type ActiveInfo,
  type SessionEditor,
  type SessionSelection,
} from '../application/writingSession';
import { localShortcutRegistry } from '../application/shortcuts';
import { createEditorState } from '../editor/state';
import { mountScreenplayEditor } from '../editor/view';
import { executeEditorCommand } from '../editor/shortcuts';
import { sourceImportTransaction } from '../editor/state';
import { dispatchIsolated } from '../editor/formatting';
import { createCompletionPopup } from './CompletionPopup';
import { EditorControls } from './EditorControls';
import { ProtectedClosePanel } from './ProtectedClosePanel';
import { RecoveryChoicePanel } from './RecoveryChoicePanel';
import { SnapshotPanel } from './SnapshotPanel';
import { createFountainImportPanel } from './FountainImportPanel';
import type { CheckpointRequest } from '../application/documents';

export interface WritingPorts {
  entry: DocumentEntryPort;
  documents: DocumentPort;
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  choices: RecoveryChoicesPort;
  recovery: RecoveryPort;
  fountainImport: FountainImportPort;
}

export type OpenRequest = { kind: 'new' } | { kind: 'picked' };

function toSessionSelection(view: EditorView): SessionSelection | null {
  return {
    anchor: view.state.selection.anchor,
    head: view.state.selection.head,
  };
}

function writingFailureMessage(failure: unknown): string {
  if (failure instanceof Error) return failure.message;
  const value = failure as { code?: string; error?: { code?: string } } | null;
  const code = value?.error?.code ?? value?.code;
  const messages: Record<string, string> = {
    checkpointConflict:
      'Recovery contains a different draft at this version. Your current text stays open; save a copy before retrying.',
    staleRecoveryVersion:
      'Recovery holds a newer version. Your current text stays open; refresh the recovery comparison.',
    recoveryNeedsAttention:
      'Existing recovery needs review. Your current text stays open; save a copy or review recovery.',
    invalidDestination:
      'The selected destination is unavailable or unsafe. Choose another location.',
    sourceChanged:
      'The source changed outside this session. Both versions are preserved; save a copy before choosing how to continue.',
    permissionDenied:
      'Writing was denied. Your text stays open; choose a writable copy destination.',
    io: 'The storage operation failed. Your text stays open; retry or save a copy to another location.',
    historyNeedsAttention:
      'Local history needs attention. Normal saving and emergency copies remain available.',
  };
  return code
    ? (messages[code] ??
        `The action could not be confirmed (${code}). Your text stays open.`)
    : 'The action could not be confirmed. Your text stays open.';
}

function clampedSelection(
  doc: import('prosemirror-model').Node,
  selection: SessionSelection,
) {
  const clamp = (position: number) =>
    TextSelection.near(
      doc.resolve(Math.max(0, Math.min(position, doc.content.size))),
    ).from;
  return TextSelection.create(
    doc,
    clamp(selection.anchor),
    clamp(selection.head),
  );
}

export function WritingView({
  ports,
  open,
  onSessionClosed,
  onOpenRequested,
}: {
  ports: WritingPorts;
  open: OpenRequest;
  onSessionClosed: () => void;
  onOpenRequested?: () => void;
}) {
  const registry = useMemo(
    () =>
      localShortcutRegistry(/Mac/.test(navigator.platform) ? 'mac' : 'other'),
    [],
  );
  const editorHost = useRef<HTMLDivElement | null>(null);
  const stagedImportRef = useRef('');
  const importHost = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const popupRef = useRef<ReturnType<typeof createCompletionPopup> | null>(
    null,
  );
  const boundaryRef = useRef<EditorCaptureBoundary | null>(null);
  const frozenRef = useRef(false);
  const writableRef = useRef(true);
  const readyRef = useRef(false);
  const adoptingRef = useRef(false);
  const windowCloseRef = useRef(false);
  const operationRef = useRef(false);
  const pendingSwitchRef = useRef(false);
  const sessionRef = useRef<WritingSession | null>(null);
  const [phase, setPhase] = useState<'opening' | 'active' | 'failed'>(
    'opening',
  );
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActiveInfo | null>(null);
  const [status, setStatus] = useState('');
  const [live, setLive] = useState<CapturedSnapshot | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [copyDestination, setCopyDestination] =
    useState<CopyDestination | null>(null);
  const [candidates, setCandidates] = useState<RecoveryCandidate[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      setActive(session.active);
      const described = session.cadenceStatus;
      setStatus(
        `Recovery: journaled version ${described.journaledVersion}. ` +
          `Source file: ${described.status} (saved version ${described.fileSavedVersion}). ` +
          `Snapshots: ${described.snapshotAttention ? 'need attention' : 'healthy'}` +
          (described.lastRollingVersion !== null
            ? `, last rolling version ${described.lastRollingVersion}`
            : ', no rolling snapshot yet') +
          '. History: local revisions are not available yet.',
      );
    } catch {
      // Session retired; the closing path owns the UI from here.
    }
  };

  useEffect(() => {
    let alive = true;
    let capturing = false;
    let captureAgain = false;
    const changed = () => {
      if (adoptingRef.current || !alive) return;
      captureAgain = true;
      if (capturing) return;
      capturing = true;
      void (async () => {
        try {
          do {
            captureAgain = false;
            try {
              await sessionRef.current?.noteEdit();
            } catch (failure) {
              if (!captureAgain && alive)
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'Edit could not be recorded',
                );
            }
          } while (captureAgain && alive);
          if (alive) refresh();
        } finally {
          capturing = false;
        }
      })();
    };
    const editor: SessionEditor = {
      loadInitial(source, selection, writable, initialVersion) {
        writableRef.current = writable;
        viewRef.current?.destroy();
        popupRef.current?.destroy();
        const host = editorHost.current;
        if (!host) throw new Error('Editor host unavailable');
        let state = createEditorState(
          Uint8Array.from(source),
          undefined,
          initialVersion,
        );
        if (selection)
          state = state.apply(
            state.tr.setSelection(clampedSelection(state.doc, selection)),
          );
        const popup = createCompletionPopup(host);
        popupRef.current = popup;
        const boundary = new EditorCaptureBoundary(() => {
          const view = viewRef.current;
          if (!view) throw new Error('Editor unavailable');
          return view.state;
        });
        boundaryRef.current = boundary;
        const view = mountScreenplayEditor(host, state, {
          shortcuts: registry,
          completion: popup.controller,
          refused: (reason) => {
            if (alive) setError(reason ?? 'Edit refused');
          },
          canEdit: () =>
            adoptingRef.current ||
            (writableRef.current && readyRef.current && !frozenRef.current),
          escapeFocus: () => {
            const root = host.closest('main');
            const target = root?.querySelector<HTMLElement>(
              '.actions button:not(:disabled)',
            );
            target?.focus();
          },
          changed,
        });
        popup.bind(view);
        viewRef.current = view;
        view.focus();
      },
      applySource(source, version, selection) {
        const view = viewRef.current;
        if (!view || view.isDestroyed) throw new Error('Editor unavailable');
        let transaction = sourceImportTransaction(
          view.state,
          Uint8Array.from(source),
          version,
        );
        if (selection)
          transaction = transaction.setSelection(
            clampedSelection(transaction.doc, selection),
          );
        adoptingRef.current = true;
        try {
          dispatchIsolated(view, transaction);
        } finally {
          adoptingRef.current = false;
        }
      },
      async capture() {
        const boundary = boundaryRef.current;
        if (!boundary) throw new Error('Editor unavailable');
        const result = await boundary.capture();
        if (result.status !== 'current')
          throw new Error('Editor changed during capture');
        if (alive) setLive(result.snapshot);
        return result.snapshot;
      },
      freeze() {
        if (frozenRef.current) throw new Error('Editor is already frozen');
        frozenRef.current = true;
        if (viewRef.current?.composing) {
          frozenRef.current = false;
          throw new Error(
            'Finish composing before protecting or switching the session',
          );
        }
        popupRef.current?.controller.dismiss();
        viewRef.current?.setProps({});
        return () => {
          frozenRef.current = false;
          if (!viewRef.current?.isDestroyed) viewRef.current?.setProps({});
        };
      },
      getSelection() {
        const view = viewRef.current;
        if (!view || view.isDestroyed) return null;
        return toSessionSelection(view);
      },
      setSelection(selection) {
        if (selection) applySelection(selection);
      },
    };
    function applySelection(selection: SessionSelection) {
      const view = viewRef.current;
      if (!view || view.isDestroyed) return;
      try {
        view.dispatch(
          view.state.tr.setSelection(
            clampedSelection(view.state.doc, selection),
          ),
        );
      } catch {
        // Best effort only; never break adoption on an unmappable caret.
      }
    }
    const session = new WritingSession(
      {
        entry: ports.entry,
        documents: ports.documents,
        saveAs: ports.saveAs,
        snapshots: ports.snapshots,
        recovery: ports.recovery,
      },
      editor,
      undefined,
      () => {
        if (alive) refresh();
      },
    );
    sessionRef.current = session;
    void (async () => {
      try {
        if (open.kind === 'new') await session.openNew();
        else if (!(await session.openPicked())) {
          if (alive) onSessionClosed();
          return;
        }
        if (!alive) {
          // A dead mount (dev double-mount) opened natively after unmount:
          // release the orphan instead of leaking a registration.
          await session.abandon();
          return;
        }
        refresh();
        readyRef.current = true;
        viewRef.current?.setProps({});
        setPhase('active');
        void ports.recovery
          .list()
          .then((catalog) => {
            if (!alive) return;
            const id = session.active?.identity.documentId;
            setCandidates(
              catalog.entries
                .filter((entry) => entry.documentId === id)
                .flatMap((entry) => [...entry.candidates]),
            );
          })
          .catch(() => {
            // Recovery discovery is advisory; the session stays usable.
          });
      } catch (failure: unknown) {
        if (alive) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not open the screenplay',
          );
          setPhase('failed');
        }
      }
    })();
    if ('__TAURI_INTERNALS__' in window) {
      let stop: (() => void) | undefined;
      void listen('protected-close-requested', () => {
        if (alive) {
          windowCloseRef.current = true;
          setShowClose(true);
        }
      }).then(
        (stopListening) => {
          if (alive) stop = stopListening;
          else stopListening();
        },
        () => undefined,
      );
      return () => {
        alive = false;
        stop?.();
        popupRef.current?.destroy();
        viewRef.current?.destroy();
        session.dispose();
      };
    }
    return () => {
      alive = false;
      popupRef.current?.destroy();
      viewRef.current?.destroy();
      session.dispose();
    };
    // One session per mounted view; panels refresh through status state.
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = registry.match(event);
      const session = sessionRef.current;
      if (
        !session?.active ||
        command?.scope !== 'application' ||
        command.unavailable
      )
        return;
      if (!['save', 'saveAs', 'open'].includes(command.id)) return;
      event.preventDefault();
      if (operationRef.current || showClose) return;
      if (command.id === 'open') {
        pendingSwitchRef.current = true;
        setShowClose(true);
      } else if (command.id === 'saveAs')
        void run(() => session.saveAs().then(reportOutcome));
      else void run(() => session.save().then(() => refresh()));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, showClose, registry]);

  useEffect(() => {
    if (!importHost.current || !active || active.readOnly || phase !== 'active')
      return;
    const view = viewRef.current;
    if (!view) return;
    const boundary = new FountainImportBoundary(
      () => view,
      active.identity,
      () => sessionRef.current?.active?.fingerprint ?? null,
      ports.fountainImport,
    );
    const panel = createFountainImportPanel(importHost.current, boundary);
    panel.input.value = stagedImportRef.current;
    return () => {
      stagedImportRef.current = panel.input.value;
      panel.destroy();
    };
  }, [
    ports.fountainImport,
    active?.identity.documentId,
    active?.identity.handle,
    phase,
  ]);

  const run = async (action: () => Promise<unknown>) => {
    if (operationRef.current) {
      setError(
        'Another writing action is pending. Try again when it finishes.',
      );
      return;
    }
    operationRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure: unknown) {
      setError(writingFailureMessage(failure));
    } finally {
      operationRef.current = false;
      setBusy(false);
      refresh();
    }
  };

  const reportOutcome = (outcome: { status: string; fileName?: string }) => {
    if (outcome.status === 'cancelled')
      setError('The native dialog was cancelled. Nothing changed.');
    else if (outcome.fileName) {
      setError('');
      if (outcome.status === 'published') {
        setCopyDestination(null);
        setCandidates([]);
      }
    }
    refresh();
  };

  const snapshotPort = useMemo<SnapshotPort>(
    () => ({
      ...ports.snapshots,
      restore: async (request) => {
        if (operationRef.current)
          throw new Error('Another writing action is pending');
        operationRef.current = true;
        try {
          return await sessionRef.current!.replaceFromNative(
            async (current) => {
              const read = await ports.snapshots.read({
                identity: current.identity,
                selection: request.selection,
              });
              const receipt = await ports.snapshots.restore({
                ...request,
                current,
                expectedFingerprint: current.expectedFingerprint!,
                newVersion: Math.max(request.newVersion, current.version + 1),
              });
              return { source: read.source, receipt };
            },
          );
        } finally {
          operationRef.current = false;
          refresh();
        }
      },
    }),
    [ports],
  );
  const choicePort = useMemo<RecoveryChoicesPort>(
    () => ({
      ...ports.choices,
      recover: async (request) => {
        if (operationRef.current)
          throw new Error('Another writing action is pending');
        operationRef.current = true;
        try {
          return await sessionRef.current!.replaceFromNative(
            async (current) => {
              const preview = await ports.recovery.preview(request.selection);
              const receipt = await ports.choices.recover({
                ...request,
                identity: current.identity,
                expectedFingerprint: current.expectedFingerprint!,
                newVersion: Math.max(
                  request.newVersion,
                  current.version + 1,
                  preview.candidate.version + 1,
                ),
              });
              return { source: preview.source, receipt };
            },
          );
        } finally {
          operationRef.current = false;
          refresh();
        }
      },
      resolve: async (identity) => {
        if (operationRef.current)
          throw new Error('Another writing action is pending');
        operationRef.current = true;
        try {
          return await sessionRef.current!.resolveNative(() =>
            ports.choices.resolve(identity),
          );
        } finally {
          operationRef.current = false;
          refresh();
        }
      },
    }),
    [ports],
  );

  // The editor and import hosts are keyed so React preserves their DOM across
  // phase changes. Unkeyed conditional trees unmounted ProseMirror's DOM out
  // from under the live view, silently detaching the editor.
  const hosts = (
    <div key="writing-hosts">
      <div ref={editorHost} aria-label="Screenplay editor" />
      <div ref={importHost} />
    </div>
  );
  if (phase === 'opening')
    return (
      <main className="shell writing">
        <p role="status">Opening the screenplay…</p>
        {hosts}
      </main>
    );
  if (phase === 'failed')
    return (
      <main className="shell writing">
        <p role="alert">{error || 'Could not open the screenplay.'}</p>
        <button type="button" onClick={onSessionClosed}>
          Back
        </button>
        {hosts}
      </main>
    );

  const session = sessionRef.current;
  const checkpoint: CheckpointRequest | null =
    active && live
      ? {
          identity: active.identity,
          version: live.version,
          source: live.source,
          sourceSha256: live.sourceSha256,
          expectedFingerprint: active.fingerprint,
          draftMetadata: live.draftMetadata,
        }
      : null;
  const view = viewRef.current;

  return (
    <main className="shell writing">
      <h1>Writing</h1>
      <p className="focus-help">
        F6 moves focus from the editor to screenplay actions. Tab then moves
        between controls.
      </p>
      {active?.readOnly && <p role="alert">{active.readOnlyReason}</p>}
      <div className="actions" aria-label="Screenplay actions">
        <button
          id="writing-save"
          type="button"
          disabled={busy || !active || active.readOnly}
          onClick={() =>
            session && void run(() => session.save().then(() => refresh()))
          }
        >
          {active?.kind === 'unsaved' ? 'Protect draft' : 'Save'}
        </button>
        <button
          type="button"
          disabled={busy || !active || active.readOnly}
          onClick={() =>
            session && void run(() => session.saveAs().then(reportOutcome))
          }
        >
          Save As
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() =>
            session && void run(() => session.exportCopy().then(reportOutcome))
          }
        >
          Export Fountain copy
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() =>
            session &&
            active &&
            void run(async () => {
              const destination = await ports.entry.selectDestination(
                active.identity,
              );
              setCopyDestination(destination);
              if (!destination)
                setError('The native dialog was cancelled. Nothing changed.');
            })
          }
        >
          Select copy destination
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() => setShowClose(true)}
        >
          Close session
        </button>
      </div>
      {view && (
        <EditorControls
          state={view.state}
          registry={registry}
          focusTargetLabel="screenplay actions"
          execute={(id) => {
            const current = viewRef.current;
            if (id === 'save') {
              if (session) void run(() => session.save());
              return;
            }
            if (id === 'saveAs') {
              if (session) void run(() => session.saveAs().then(reportOutcome));
              return;
            }
            if (id === 'open') {
              pendingSwitchRef.current = true;
              setShowClose(true);
              return;
            }
            if (current)
              executeEditorCommand(current, id, (reason) =>
                setError(reason ?? 'Edit refused'),
              );
            refresh();
          }}
        />
      )}
      {hosts}
      <section aria-label="Protection status">
        <p role="status">{status || 'Protection status unavailable.'}</p>
        {error && <p role="alert">{error}</p>}
      </section>
      {session && session.active && showClose && (
        <ProtectedClosePanel
          close={session.close}
          statusToken={`${active?.liveVersion}:${status}`}
          destination={copyDestination ?? undefined}
          onClosed={() => {
            setShowClose(false);
            session.finishClose();
            if (windowCloseRef.current) {
              void getCurrentWindow()
                .close()
                .catch(() =>
                  setError(
                    'The document is protected, but the window could not close. Try closing again.',
                  ),
                );
            } else if (pendingSwitchRef.current && onOpenRequested)
              onOpenRequested();
            else onSessionClosed();
          }}
        />
      )}
      {active && !active.readOnly && checkpoint && (
        <SnapshotPanel
          port={snapshotPort}
          current={checkpoint}
          destination={copyDestination ?? undefined}
          nextVersion={active.liveVersion + 1}
          onRestored={() => refresh()}
        />
      )}
      {active &&
        !active.readOnly &&
        active.fingerprint &&
        candidates.map((candidate) => (
          <RecoveryChoicePanel
            key={`${active.identity.handle}:${candidate.selection.origin}:${candidate.selection.recordSha256}`}
            port={choicePort}
            identity={active.identity}
            selection={candidate.selection}
            expectedFingerprint={active.fingerprint!}
            nextVersion={Math.max(
              active.liveVersion + 1,
              ...candidates.map((item) => item.version + 1),
            )}
            onRecovered={() => refresh()}
            onResolved={() => refresh()}
          />
        ))}
    </main>
  );
}
