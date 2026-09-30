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
import {
  ManuscriptProjectionController,
  type ProjectionState,
} from '../application/manuscriptProjection';
import { MovePreview } from './MovePreview';
import {
  prepareEditorMove,
  applyPreparedMove,
  type PreparedMove,
} from '../editor/sceneMoves';
import type { MoveRequest } from '../domain/sceneMoves';
import { Outline } from './Outline';
import { TitlePagePanel } from './TitlePagePanel';
import { FindPanel } from './FindPanel';
import { FindController, type FindState } from '../application/find';
import { highlightFind, navigateFind } from '../editor/find';
import { ScriptCheckPanel } from './ScriptCheckPanel';
import {
  ScriptCheckController,
  visibleIssues,
  type CheckState,
} from '../application/scriptCheck';
import {
  highlightCheckIssues,
  navigateCheckIssue,
} from '../editor/scriptCheck';
import type { CheckIssue } from '../domain/scriptCheck';
import { prepareEditorReplace, type ReplacePlan } from '../editor/replace';
import { navigateOutline } from '../editor/outlineNavigation';
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
import {
  applyEditorTransaction,
  createEditorState,
  editorVersion,
  editorOrigin,
} from '../editor/state';
import {
  editorRecovery,
  metadataSelection,
} from '../application/editorMetadata';
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

import type {
  RecentProjectsPort,
  LocateSelection,
  LocateChoice,
} from '../application/recentProjects';

export interface WritingPorts {
  entry: DocumentEntryPort;
  documents: DocumentPort;
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  choices: RecoveryChoicesPort;
  recovery: RecoveryPort;
  fountainImport: FountainImportPort;
  workflows?: import('../application/workflowProtection').WorkflowProtectionPort;
}

export type OpenRequest =
  | { kind: 'new'; destination?: boolean }
  | { kind: 'recent'; entryId: string }
  | { kind: 'located'; selection: LocateSelection; choice: LocateChoice }
  | { kind: 'picked' }
  | {
      kind: 'recovered';
      selection: import('../application/startupRecovery').RecoverySelection;
    };

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
  recents,
}: {
  ports: WritingPorts;
  recents?: RecentProjectsPort;
  open: OpenRequest;
  onSessionClosed: (message?: string) => void;
  onOpenRequested?: () => void;
}) {
  const registry = useMemo(
    () =>
      localShortcutRegistry(/Mac/.test(navigator.platform) ? 'mac' : 'other'),
    [],
  );
  const editorHost = useRef<HTMLDivElement | null>(null);
  const stagedImportRef = useRef('');
  const titleDraftRef = useRef(false);
  const titleComposingRef = useRef(false);
  const titleApplyingRef = useRef(false);
  const [showTitle, setShowTitle] = useState(false);
  const findRef = useRef<FindController | null>(null);
  const findScrollRef = useRef<{
    view: EditorView;
    session: object;
    version: number;
    doc: import('prosemirror-model').Node;
    selection: import('prosemirror-state').Selection;
  } | null>(null);
  const [findState, setFindState] = useState<FindState | null>(null);
  const checkScrollRef = useRef<{
    view: EditorView;
    session: object;
    version: number;
    doc: import('prosemirror-model').Node;
    selection: import('prosemirror-state').Selection;
  } | null>(null);
  const [checkState, setCheckState] = useState<CheckState | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const checkRef = useRef<ScriptCheckController | null>(null);
  const [replaceMessage, setReplaceMessage] = useState('');
  const replaceAdvanceRef = useRef<{
    query: string;
    options: string;
    index: number;
  } | null>(null);
  const titleButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleReturnFocusRef = useRef(false);
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
  const [move, setMove] = useState<PreparedMove | null>(null);
  const [moveMessage, setMoveMessage] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const moveAbortRef = useRef<AbortController | null>(null);
  const [outline, setOutline] = useState<ProjectionState>({
    phase: 'pending',
    projection: null,
    message: 'Preparing outline…',
  });

  useEffect(() => {
    if (!showTitle && titleReturnFocusRef.current) {
      titleReturnFocusRef.current = false;
      titleButtonRef.current?.focus();
    }
  }, [showTitle]);

  useEffect(() => {
    const target = findScrollRef.current;
    const find = findRef.current;
    if (
      !target ||
      !find ||
      !findState?.enabled ||
      findState.phase !== 'current' ||
      !find.isCurrent(findState.projection)
    )
      return;
    findScrollRef.current = null;
    // React has committed the result/reveal panel; scroll only the still-current selection.
    requestAnimationFrame(() => {
      const view = target.view;
      if (
        view.isDestroyed ||
        view.composing ||
        !find.state.enabled ||
        operationRef.current ||
        frozenRef.current ||
        !view.hasFocus() ||
        editorOrigin(view.state).session !== target.session ||
        editorVersion(view.state) !== target.version ||
        view.state.doc !== target.doc ||
        !view.state.selection.eq(target.selection)
      )
        return;
      view.dispatch(
        view.state.tr.setMeta('addToHistory', false).scrollIntoView(),
      );
    });
  }, [findState]);

  useEffect(() => {
    // Replace-one advances to the match that followed the replaced one once
    // refreshed results are current. The caret resting at the replacement is
    // the honest fallback when nothing follows.
    const pending = replaceAdvanceRef.current;
    const find = findRef.current;
    const view = viewRef.current;
    if (!pending || !find || !view || view.isDestroyed) return;
    if (
      !findState?.enabled ||
      findState.phase !== 'current' ||
      !find.isCurrent(findState.projection)
    )
      return;
    if (
      findState.options.query !== pending.query ||
      JSON.stringify(findState.options) !== pending.options
    ) {
      replaceAdvanceRef.current = null;
      return;
    }
    replaceAdvanceRef.current = null;
    if (!findState.matches.length) return;
    const index = Math.min(pending.index, findState.matches.length - 1);
    if (
      find.navigate(
        1,
        (projection, match) => navigateFind(view, projection, match, false),
        index,
      )
    ) {
      findScrollRef.current = {
        view,
        session: editorOrigin(view.state).session,
        version: editorVersion(view.state),
        doc: view.state.doc,
        selection: view.state.selection,
      };
    }
  }, [findState]);

  const refresh = () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      setActive(session.active);
      const described = session.cadenceStatus;
      setStatus(
        `Live version ${described.liveVersion}. Recovery: journaled version ${described.journaledVersion}. ` +
          `Source file: ${described.status} (saved version ${described.fileSavedVersion}). ` +
          `Snapshots: ${described.snapshotAttention ? 'need attention' : 'healthy'}` +
          (described.lastRollingVersion !== null
            ? `, last rolling version ${described.lastRollingVersion}`
            : ', no rolling snapshot yet') +
          '. History: timeline is not available yet.' +
          (session.close.assessment.onlyInMemory
            ? ' Newer changes exist only in memory until protection is confirmed.'
            : ''),
      );
    } catch {
      // Session retired; the closing path owns the UI from here.
    }
  };

  useEffect(() => {
    let alive = true;
    let capturing = false;
    let captureAgain = false;
    const stamp = () => {
      const view = viewRef.current;
      return view && !view.isDestroyed
        ? {
            session: editorOrigin(view.state).session,
            version: editorVersion(view.state),
            doc: view.state.doc,
          }
        : null;
    };
    const find = new FindController(stamp, (state) => {
      if (!alive) return;
      setFindState(state);
      const view = viewRef.current;
      if (
        view &&
        !operationRef.current &&
        !frozenRef.current &&
        !titleDraftRef.current &&
        !titleComposingRef.current
      )
        highlightFind(
          view,
          state.phase === 'current' ? state.projection : null,
          state.matches,
          state.active,
        );
    });
    findRef.current = find;
    const check = new ScriptCheckController(stamp, (state) => {
      if (!alive) return;
      setCheckState(state);
      const view = viewRef.current;
      if (
        view &&
        !operationRef.current &&
        !frozenRef.current &&
        !titleDraftRef.current &&
        !titleComposingRef.current
      )
        highlightCheckIssues(
          view,
          state.phase === 'current' ? state.projection : null,
          visibleIssues(state),
        );
    });
    checkRef.current = check;
    const projection = new ManuscriptProjectionController(stamp, (state) => {
      if (alive) setOutline(state);
      find.setProjection(
        state,
        viewRef.current?.state.selection.$head.index(0) ?? -1,
      );
      check.setProjection(state);
    });
    let navigationCapture = false;
    const changed = (
      _state?: import('prosemirror-state').EditorState,
      transaction?: import('prosemirror-state').Transaction,
    ) => {
      if (transaction?.getMeta('findNavigation')) {
        // Unchanged content needs no stale-outline repaint; every old anchor still checks its stamp.
        find.setProjection(
          {
            phase: 'pending',
            projection: projection.state.projection,
            message: 'Updating selection…',
          },
          viewRef.current?.state.selection.$head.index(0) ?? -1,
        );
        // Rebind branded immutable source off the key path; never schedule native protection.
        const previous = projection.state.projection;
        const boundary = boundaryRef.current;
        if (!navigationCapture && alive && previous && boundary) {
          navigationCapture = true;
          setTimeout(() => {
            navigationCapture = false;
            if (!alive || boundaryRef.current !== boundary) return;
            try {
              const snapshot = boundary.rebindSelection(previous.snapshot);
              const current = stamp();
              if (snapshot && current) projection.accept(snapshot, current);
            } catch {
              projection.unavailable();
            }
          }, 0);
        }
        return;
      }
      projection.changedDraft();
      if (adoptingRef.current || !alive) return;
      captureAgain = true;
      refresh();
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
    const installState = (
      state: import('prosemirror-state').EditorState,
      writable: boolean,
    ) => {
      projection.changedDraft();
      writableRef.current = writable;
      viewRef.current?.destroy();
      popupRef.current?.destroy();
      const host = editorHost.current;
      if (!host) throw new Error('Editor host unavailable');
      const popup = createCompletionPopup(host);
      popupRef.current = popup;
      const boundary = new EditorCaptureBoundary(() => {
        const view = viewRef.current;
        if (!view || view.isDestroyed) throw new Error('Editor unavailable');
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
          (writableRef.current &&
            readyRef.current &&
            !frozenRef.current &&
            ((!titleDraftRef.current && !titleComposingRef.current) ||
              titleApplyingRef.current)),
        canNavigate: () => readyRef.current && !frozenRef.current,
        escapeFocus: () => {
          host
            .closest('main')
            ?.querySelector<HTMLElement>('.actions button:not(:disabled)')
            ?.focus();
        },
        changed,
      });
      popup.bind(view);
      viewRef.current = view;
      view.focus();
    };
    const editor: SessionEditor = {
      getVersion: () =>
        viewRef.current ? editorVersion(viewRef.current.state) : 0,
      captureDraft: async () => {
        if (!boundaryRef.current) throw new Error('Editor unavailable');
        return boundaryRef.current.captureDraft();
      },
      loadInitial(source, selection, writable, initialVersion, metadata) {
        const bytes = Uint8Array.from(source);
        let state = createEditorState(
          bytes,
          editorRecovery(bytes, metadata),
          initialVersion,
        );
        if (selection)
          state = state.apply(
            state.tr.setSelection(clampedSelection(state.doc, selection)),
          );
        else {
          const restored = metadataSelection(state, metadata);
          if (restored) state = state.apply(state.tr.setSelection(restored));
        }
        installState(state, writable);
      },
      retain() {
        const state = viewRef.current?.state;
        const writable = writableRef.current;
        if (!state) throw new Error('Editor unavailable');
        return () => installState(state, writable);
      },
      async prepareSource(source, version, metadata) {
        if (titleDraftRef.current || titleComposingRef.current)
          throw new Error(
            'Apply or Discard the uncommitted title input before replacing the screenplay.',
          );
        const view = viewRef.current;
        if (!view || view.isDestroyed) throw new Error('Editor unavailable');
        const previous = view.state;
        const bytes = Uint8Array.from(source);
        let transaction = sourceImportTransaction(
          previous,
          bytes,
          version,
          editorRecovery(bytes, metadata),
        );
        let next = applyEditorTransaction(previous, transaction);
        if (!next.accepted)
          throw new Error('Replacement projection was refused');
        const selection =
          metadataSelection(next.state, metadata) ??
          clampedSelection(next.state.doc, toSessionSelection(view)!);
        transaction = transaction.setSelection(selection);
        next = applyEditorTransaction(previous, transaction);
        const snapshot = (
          await new EditorCaptureBoundary(() => next.state).capture()
        ).snapshot;
        return {
          snapshot,
          apply() {
            if (viewRef.current !== view || view.state !== previous)
              throw new Error('Editor changed during replacement');
            adoptingRef.current = true;
            try {
              dispatchIsolated(view, transaction);
            } finally {
              adoptingRef.current = false;
            }
          },
        };
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
        const started = stamp();
        try {
          const previous = projection.state.projection;
          const result = await boundary.capture({
            latest: true,
            afterPaint: Boolean(
              started &&
              previous &&
              started.session === previous.session &&
              started.doc === previous.doc,
            ),
          });
          if (
            result.status !== 'current' ||
            boundaryRef.current !== boundary ||
            !boundary.isCurrent(result.snapshot)
          )
            throw new Error('Editor changed during capture');
          const capturedStamp = stamp();
          if (alive && capturedStamp) {
            setLive(result.snapshot);
            projection.accept(result.snapshot, capturedStamp);
          }
          return result.snapshot;
        } catch (failure) {
          const current = stamp();
          if (
            alive &&
            boundaryRef.current === boundary &&
            current &&
            started &&
            current.session === started.session &&
            current.version === started.version &&
            current.doc === started.doc
          )
            projection.unavailable();
          throw failure;
        }
      },
      freeze() {
        if (titleDraftRef.current || titleComposingRef.current)
          throw new Error(
            'Apply or Discard the uncommitted title input before protecting or switching the session.',
          );
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
      workflowState() {
        const view = viewRef.current;
        return view && !view.isDestroyed
          ? { token: view.state, composing: view.composing }
          : null;
      },
      applyWorkflow(apply) {
        adoptingRef.current = true;
        try {
          return apply();
        } finally {
          adoptingRef.current = false;
          changed();
        }
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
        workflows: ports.workflows,
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
        else if (open.kind === 'recovered')
          await session.openRecovery(open.selection);
        else if (open.kind === 'recent' || open.kind === 'located') {
          if (!recents)
            throw new Error(
              'Recent screenplays are unavailable. Use Open Fountain.',
            );
          await session.openSelected(async () => {
            const result =
              open.kind === 'recent'
                ? await recents.open(open.entryId)
                : await recents.confirmLocation(open.selection, open.choice);
            if (alive && result.registryHealth === 'needsAttention')
              setError(
                'Recent metadata needs attention. The screenplay is open; source saving and recovery remain separate.',
              );
            return result.document;
          });
        } else if (!(await session.openPicked())) {
          if (alive)
            onSessionClosed(
              'Open cancelled. No screenplay was opened; source and recovery files are unchanged.',
            );
          return;
        }
        if (!alive) {
          // A dead mount (dev double-mount) opened natively after unmount:
          // release the orphan instead of leaking a registration.
          await session.abandon();
          return;
        }
        if (open.kind === 'new') {
          operationRef.current = true;
          setBusy(true);
          try {
            const protection = await session.save();
            if (alive)
              setError(
                protection.recovered
                  ? `Unsaved draft protected by local recovery at initial version ${session.active!.liveVersion}. Newer edits need their own confirmation. No source file has been created.`
                  : 'Unsaved draft protection is unconfirmed. Keep this session open and retry Protect draft.',
              );
            if (alive && open.destination) {
              const outcome = await session.saveAs();
              if (alive) {
                setError(
                  outcome.status === 'cancelled'
                    ? 'Destination cancelled. Your draft remains open; local recovery and source saving are separate. No source file was created.'
                    : 'New screenplay published to the chosen destination.',
                );
                setCopyDestination(null);
              }
            }
          } catch (failure) {
            if (alive)
              setError(
                'The new draft stays open. Destination or protection could not be confirmed. Retry Protect draft or Save As. ' +
                  writingFailureMessage(failure),
              );
          } finally {
            operationRef.current = false;
            if (alive) {
              setBusy(false);
              refresh();
            }
          }
        }
        if (!alive || !session.active) return;
        refresh();
        readyRef.current = true;
        viewRef.current?.setProps({});
        setPhase('active');

        void ports.recovery
          .inspect(session.active.identity)
          .then((entry) => {
            if (!alive) return;
            const id = session.active?.identity.documentId;
            setCandidates(entry.documentId === id ? [...entry.candidates] : []);
          })
          .catch(() => {
            // Recovery discovery is advisory; the session stays usable.
          });
      } catch (failure: unknown) {
        if (alive) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not open the screenplay. The selected file may be missing, changed or unavailable. Return Home and use Locate or Open Fountain.',
          );
          setPhase('failed');
        }
      }
    })();
    if ('__TAURI_INTERNALS__' in window) {
      let stop: (() => void) | undefined;
      void listen('protected-close-requested', () => {
        if (alive) {
          if (titleDraftRef.current || titleComposingRef.current) {
            setError(
              'Apply or Discard the uncommitted title input before closing the window.',
            );
            return;
          }
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
        moveAbortRef.current?.abort();
        projection.dispose();
        find.dispose();
        findRef.current = null;
        checkRef.current?.dispose();
        checkRef.current = null;
        stop?.();
        popupRef.current?.destroy();
        viewRef.current?.destroy();
        session.dispose();
      };
    }
    return () => {
      alive = false;
      moveAbortRef.current?.abort();
      projection.dispose();
      find.dispose();
      findRef.current = null;
      checkRef.current?.dispose();
      checkRef.current = null;
      popupRef.current?.destroy();
      viewRef.current?.destroy();
      session.dispose();
    };
    // One session per mounted view; panels refresh through status state.
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        titleComposingRef.current
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('.title-page-panel input, .title-page-panel textarea')
      )
        return;
      const command = registry.match(event);
      const session = sessionRef.current;
      if (
        !session?.active ||
        command?.scope !== 'application' ||
        command.unavailable
      )
        return;
      if (['find', 'nextMatch', 'previousMatch'].includes(command.id)) {
        event.preventDefault();
        if (
          operationRef.current ||
          showClose ||
          titleDraftRef.current ||
          viewRef.current?.composing
        )
          return;
        if (command.id === 'find') openFind();
        else navigateSearch(command.id === 'nextMatch' ? 1 : -1);
        return;
      }
      // Search input owns ordinary typing/Undo, while application commands remain available.
      if (!['save', 'saveAs', 'open'].includes(command.id)) return;
      event.preventDefault();
      if (operationRef.current || showClose || titleDraftRef.current) {
        if (titleDraftRef.current)
          setError(
            'Apply or Discard the uncommitted title input before saving or switching.',
          );
        return;
      }
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
      undefined,
      ports.workflows
        ? (apply, signal) =>
            sessionRef.current!.runProtectedWorkflow(
              'fountainImport',
              apply,
              signal,
            )
        : undefined,
    );
    const panel = createFountainImportPanel(importHost.current, boundary);
    panel.input.value = stagedImportRef.current;
    return () => {
      stagedImportRef.current = panel.input.value;
      panel.destroy();
    };
  }, [
    ports.fountainImport,
    ports.workflows,
    active?.identity.documentId,
    active?.identity.handle,
    phase,
  ]);

  const run = async (action: () => Promise<unknown>) => {
    if (titleDraftRef.current || titleComposingRef.current) {
      setError(
        'Apply or Discard the uncommitted title input before saving or leaving.',
      );
      return;
    }
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

  const requestClose = (switching = false) => {
    if (titleDraftRef.current || titleComposingRef.current) {
      setError(
        'Apply or Discard the uncommitted title input before leaving the screenplay.',
      );
      return;
    }
    pendingSwitchRef.current = switching;
    setShowClose(true);
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
            async (current, prepare) => {
              const read = await ports.snapshots.read({
                identity: current.identity,
                selection: request.selection,
              });
              const newVersion = Math.max(
                request.newVersion,
                current.version + 1,
              );
              const replacement = await prepare(read.source, newVersion);
              const receipt = await ports.snapshots.restore({
                ...request,
                current,
                expectedFingerprint: current.expectedFingerprint!,
                newVersion,
                replacementMetadata: replacement.draftMetadata,
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
  const choicePort = useMemo<RecoveryChoicesPort>(() => {
    // Each native comparison reserves a full bounded source buffer. Mounting
    // several journal candidates at once must not exhaust the native budget
    // and leave otherwise valid choices permanently unavailable.
    let comparisons: Promise<unknown> = Promise.resolve();
    return {
      ...ports.choices,
      compare: (request) => {
        const result = comparisons.then(() => ports.choices.compare(request));
        comparisons = result.catch(() => undefined);
        return result;
      },
      recover: async (request) => {
        if (operationRef.current)
          throw new Error('Another writing action is pending');
        operationRef.current = true;
        try {
          return await sessionRef.current!.replaceFromNative(
            async (current, prepare) => {
              const preview = await ports.recovery.previewSelected({
                identity: current.identity,
                selection: request.selection,
              });
              const newVersion = Math.max(
                request.newVersion,
                current.version + 1,
                preview.candidate.version + 1,
              );
              const replacement = await prepare(
                preview.source,
                newVersion,
                preview.metadata.draftMetadata,
              );
              const receipt = await ports.choices.recover({
                ...request,
                identity: current.identity,
                expectedFingerprint: current.expectedFingerprint!,
                newVersion,
                replacementMetadata: replacement.draftMetadata,
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
    };
  }, [ports]);

  const previewMove = (request: MoveRequest) => {
    const view = viewRef.current;
    const projection = outline.projection;
    if (
      !view ||
      !projection ||
      busy ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      !writableRef.current ||
      view.composing
    ) {
      setError(
        'Move is unavailable while read-only, composing or protecting a draft. Source retained.',
      );
      return;
    }
    try {
      setMove(prepareEditorMove(view.state, projection, request));
      setMoveMessage('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Move preview failed; source retained.',
      );
    }
  };
  const applyMove = async () => {
    const view = viewRef.current;
    const session = sessionRef.current;
    if (
      !move ||
      !view ||
      !session ||
      view.state !== move.state ||
      view.composing ||
      busy ||
      operationRef.current ||
      frozenRef.current ||
      !writableRef.current ||
      !readyRef.current
    ) {
      setMoveMessage(
        'Move refused for this version. Source and review copies retained.',
      );
      return;
    }
    operationRef.current = true;
    setBusy(true);
    setMoveBusy(true);
    const abort = new AbortController();
    moveAbortRef.current = abort;
    try {
      if (move.large) {
        setMoveMessage('Protecting the exact current draft before moving…');
        const result = await session.runProtectedWorkflow(
          move.review.kind === 'scene' ? 'sceneMove' : 'sectionMove',
          () => applyPreparedMove(view, move),
          abort.signal,
        );
        if (result.status === 'refused') {
          setMoveMessage(result.reason);
          return;
        }
      } else if (!applyPreparedMove(view, move)) {
        setMoveMessage(
          'Editor refused the move. Source and review copies retained.',
        );
        return;
      }
      setMove(null);
      setError(
        'Move applied. Undo restores the complete source and previous selection.',
      );
    } catch (failure) {
      setMoveMessage(
        failure instanceof Error
          ? failure.message
          : 'Move failed; source and review copies retained.',
      );
    } finally {
      moveAbortRef.current = null;
      operationRef.current = false;
      setBusy(false);
      setMoveBusy(false);
      refresh();
    }
  };

  const closeCheck = () => {
    setShowCheck(false);
    const view = viewRef.current;
    if (view && !view.isDestroyed) highlightCheckIssues(view, null, []);
    if (view && !view.isDestroyed && !view.composing) {
      view.dom.focus({ preventScroll: true });
      view.focus();
    }
  };
  const openCheck = () => {
    if (
      !checkRef.current ||
      viewRef.current?.composing ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    // One panel owns the shared view-only decoration channel at a time;
    // closing find clears its highlights before check paints its own.
    findRef.current?.configure(findRef.current.state.options, false);
    setShowCheck(true);
  };
  const navigateIssue = (issue: CheckIssue) => {
    const view = viewRef.current;
    const projection = checkRef.current?.state.projection;
    if (
      !view ||
      !projection ||
      view.composing ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    if (!navigateCheckIssue(view, projection, issue)) {
      setError(
        'Issue navigation is unavailable for this version. Text and selection are retained.',
      );
      return;
    }
    checkScrollRef.current = {
      view,
      session: editorOrigin(view.state).session,
      version: editorVersion(view.state),
      doc: view.state.doc,
      selection: view.state.selection,
    };
  };
  useEffect(() => {
    // Scroll once after the issue panel commits, mirroring find navigation.
    const target = checkScrollRef.current;
    const view = viewRef.current;
    if (!target || !view || view.isDestroyed || target.view !== view) return;
    checkScrollRef.current = null;
    requestAnimationFrame(() => {
      const current = target.view;
      if (
        current.isDestroyed ||
        current.composing ||
        operationRef.current ||
        frozenRef.current ||
        !current.hasFocus() ||
        editorOrigin(current.state).session !== target.session ||
        editorVersion(current.state) !== target.version ||
        current.state.doc !== target.doc ||
        !current.state.selection.eq(target.selection)
      )
        return;
      current.dispatch(
        current.state.tr.setMeta('addToHistory', false).scrollIntoView(),
      );
    });
  }, [checkState]);
  const openFind = () => {
    if (
      !findRef.current ||
      viewRef.current?.composing ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    closeCheck();
    findRef.current.configure(findRef.current.state.options, true);
    // Repeated Find focuses the existing query without replacing editor state.
    document
      .querySelector<HTMLInputElement>('.find-panel input[type="search"]')
      ?.focus();
  };
  const navigateSearch = (direction: 1 | -1, index?: number) => {
    const view = viewRef.current;
    if (
      !view ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    if (
      findRef.current?.navigate(
        direction,
        (projection, match) => navigateFind(view, projection, match, false),
        index,
      )
    ) {
      findScrollRef.current = {
        view,
        session: editorOrigin(view.state).session,
        version: editorVersion(view.state),
        doc: view.state.doc,
        selection: view.state.selection,
      };
    } else {
      setError(
        'Find navigation is unavailable for this version. Text and selection are retained.',
      );
    }
  };
  const closeFind = () => {
    findScrollRef.current = null;
    replaceAdvanceRef.current = null;
    setReplaceMessage('');
    findRef.current?.configure(findRef.current.state.options, false);
    const view = viewRef.current;
    if (view && !view.isDestroyed && !view.composing) {
      view.dom.focus({ preventScroll: true });
      view.focus();
    }
  };
  const replacePlanCurrent = (plan: ReplacePlan): boolean => {
    const find = findRef.current;
    return (
      !!find &&
      find.state.phase === 'current' &&
      find.isCurrent(find.state.projection) &&
      plan.query === find.state.options.query &&
      JSON.stringify(plan.options) === JSON.stringify(find.state.options)
    );
  };
  const dispatchReplacement = (
    plan: ReplacePlan,
    scope: { one: number } | { all: true },
  ): boolean => {
    const view = viewRef.current;
    const projection = findRef.current?.state.projection;
    setReplaceMessage('');
    if (
      !view ||
      view.isDestroyed ||
      view.composing ||
      !projection ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      busy ||
      !writableRef.current ||
      titleDraftRef.current ||
      titleComposingRef.current ||
      active?.readOnly ||
      !replacePlanCurrent(plan)
    ) {
      setReplaceMessage(
        'Replacement is unavailable for this version. Text and selection are retained.',
      );
      return false;
    }
    popupRef.current?.controller.dismiss();
    try {
      const transaction = prepareEditorReplace(
        view.state,
        projection,
        plan,
        scope,
      );
      dispatchIsolated(view, transaction);
    } catch (failure) {
      setReplaceMessage(
        failure instanceof Error
          ? failure.message
          : 'Replacement failed; source retained.',
      );
      return false;
    }
    view.dom.focus({ preventScroll: true });
    view.focus();
    return true;
  };
  const replaceOne = (plan: ReplacePlan, editIndex: number) => {
    // Advance by position in the full match list, not the edits list: refused
    // matches keep their slots, so the match after the replaced one slides
    // into the replaced match's own index once results refresh.
    const matchIndex =
      plan.edits[editIndex] &&
      findRef.current?.state.matches.indexOf(plan.edits[editIndex]!.match);
    if (
      dispatchReplacement(plan, { one: editIndex }) &&
      typeof matchIndex === 'number' &&
      matchIndex >= 0
    )
      replaceAdvanceRef.current = {
        query: plan.query,
        options: JSON.stringify(plan.options),
        index: matchIndex,
      };
  };
  const replaceAll = (plan: ReplacePlan) => {
    replaceAdvanceRef.current = null;
    if (dispatchReplacement(plan, { all: true }))
      setReplaceMessage(
        plan.edits.length === 1
          ? 'Replaced 1 match in one step. Undo restores the complete source and previous selection.'
          : `Replaced ${plan.edits.length} matches in one step. Undo restores the complete source and previous selection.`,
      );
  };

  // The editor and import hosts are keyed so React preserves their DOM across
  // phase changes. Unkeyed conditional trees unmounted ProseMirror's DOM out
  // from under the live view, silently detaching the editor.
  const hosts = (
    <div key="writing-hosts">
      {phase === 'active' && showCheck && checkRef.current && checkState && (
        <ScriptCheckPanel
          controller={checkRef.current}
          state={checkState}
          disabled={busy || showClose}
          onNavigate={navigateIssue}
          onClose={closeCheck}
        />
      )}
      {phase === 'active' && findState?.enabled && findRef.current && (
        <FindPanel
          controller={findRef.current}
          state={findState}
          disabled={busy || showClose}
          onNavigate={navigateSearch}
          onClose={closeFind}
          onReplaceOne={replaceOne}
          onReplaceAll={replaceAll}
          replaceDisabled={
            busy ||
            showClose ||
            operationRef.current ||
            frozenRef.current ||
            !readyRef.current ||
            !writableRef.current ||
            Boolean(active?.readOnly)
          }
          replaceMessage={replaceMessage}
        />
      )}
      {phase === 'active' && showTitle && viewRef.current && (
        <TitlePagePanel
          document={
            outline.phase === 'current' &&
            outline.projection?.doc === viewRef.current.state.doc
              ? outline.projection.snapshot.capture.document
              : null
          }
          state={viewRef.current.state}
          getView={() => viewRef.current}
          disabled={busy || showClose || !readyRef.current || frozenRef.current}
          readOnly={Boolean(active?.readOnly)}
          onDraft={(dirty, composing) => {
            titleDraftRef.current = dirty;
            titleComposingRef.current = composing;
            if (!viewRef.current?.isDestroyed) viewRef.current?.setProps({});
          }}
          onApply={(apply) => {
            if (
              operationRef.current ||
              frozenRef.current ||
              !readyRef.current ||
              !writableRef.current ||
              titleComposingRef.current
            )
              return false;
            titleApplyingRef.current = true;
            try {
              return apply();
            } finally {
              titleApplyingRef.current = false;
              refresh();
            }
          }}
          onClose={() => {
            titleReturnFocusRef.current = true;
            setShowTitle(false);
          }}
        />
      )}
      {phase === 'active' && (
        <Outline
          state={outline}
          disabled={busy || showClose}
          moveDisabled={Boolean(active?.readOnly) || Boolean(move)}
          onMove={previewMove}
          onNavigate={(item) => {
            const current = viewRef.current;
            const captured = outline.projection;
            if (
              !current ||
              !captured ||
              !readyRef.current ||
              frozenRef.current ||
              !navigateOutline(current, captured, item.row)
            )
              setError(
                'Outline navigation is unavailable for this version. Your selection and text are retained.',
              );
          }}
        />
      )}
      {move && (
        <MovePreview
          move={move}
          stale={viewRef.current?.state !== move.state}
          busy={moveBusy}
          message={moveMessage}
          onApply={() => void applyMove()}
          onCancel={() => {
            if (moveBusy) {
              moveAbortRef.current?.abort();
              setMoveMessage(
                'Cancellation requested; waiting for native protection to settle.',
              );
            } else {
              setMove(null);
              setMoveMessage('');
            }
          }}
        />
      )}
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
        <button type="button" onClick={() => onSessionClosed()}>
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
      {active?.readOnly && (
        <p role="alert">
          {active.readOnlyReason} Save As can preserve a separate copy without
          changing this source.
        </p>
      )}
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
          disabled={busy || !active}
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
          id="writing-find"
          aria-expanded={Boolean(findState?.enabled)}
          disabled={busy || !active || showClose}
          onClick={openFind}
        >
          Find
        </button>
        <button
          type="button"
          id="writing-check"
          aria-expanded={showCheck}
          disabled={busy || !active || showClose}
          onClick={openCheck}
        >
          Script Check
        </button>
        <button
          id="writing-title"
          ref={titleButtonRef}
          aria-expanded={showTitle}
          type="button"
          disabled={busy || !active || showTitle || showClose}
          onClick={() => {
            if (viewRef.current?.composing) {
              setError('Finish composing before opening the title page.');
              return;
            }
            popupRef.current?.controller.dismiss();
            setShowTitle(true);
          }}
        >
          Title page
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() => requestClose()}
        >
          Close session
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() => {
            requestClose();
          }}
        >
          Home
        </button>
      </div>
      {view && (
        <EditorControls
          state={view.state}
          registry={registry}
          focusTargetLabel="screenplay actions"
          execute={(id) => {
            const current = viewRef.current;
            if (id === 'find') {
              openFind();
              return;
            }
            if (id === 'nextMatch' || id === 'previousMatch') {
              navigateSearch(id === 'nextMatch' ? 1 : -1);
              return;
            }
            if (id === 'save') {
              if (session) void run(() => session.save());
              return;
            }
            if (id === 'saveAs') {
              if (session) void run(() => session.saveAs().then(reportOutcome));
              return;
            }
            if (id === 'open') {
              requestClose(true);
              return;
            }
            if (titleDraftRef.current || titleComposingRef.current) {
              setError(
                'Apply or Discard the uncommitted title input before editor commands.',
              );
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
