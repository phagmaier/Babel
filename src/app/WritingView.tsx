import {
  stampOf,
  isCurrent,
  applyEditorTransaction,
  createEditorState,
  editorVersion,
  editorOrigin,
  sourceImportTransaction,
  advanceEditorVersion,
} from '../editor/state';
import { sameStamp } from '../application/manuscriptProjection';
import { SourceComparison } from './SourceComparison';
import { PublicationPreview } from './PublicationPreview';
import { ExportPdfPanel } from './ExportPdfPanel';
import { ExportPdfController } from '../application/exportPdf';
import { PublicationPreviewController } from '../application/publicationPreview';
import { undoDepth, redoDepth } from 'prosemirror-history';
import { CommandSurface } from './CommandSurface';
import {
  commandReason,
  dispatchCommand,
  type CommandContext,
} from '../application/commandDispatch';
import {
  shortcutCommands,
  type ShortcutRegistry,
} from '../application/shortcuts';
import { SpellcheckPanel } from './SpellcheckPanel';
import {
  type SpellcheckPort,
  unavailableSpellcheck,
} from '../application/spellcheck';
import { nativeSpellcheck } from '../infrastructure/nativeSpellcheck';
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
import {
  localViewPreferences,
  type ViewPreferences,
} from '../application/viewPreferences';
import { PresentationControls, usePresentation } from './PresentationControls';
import { TypewriterScroll } from '../editor/presentation';
import type { EditorView } from 'prosemirror-view';
import { EditorCaptureBoundary } from '../application/editorCapture';
import { ManuscriptProjectionController } from '../application/manuscriptProjection';
import { MovePreview } from './MovePreview';
import { Outline } from './Outline';
import { CharacterPanel } from './CharacterPanel';
import {
  captureRecentPosition,
  recentSelection,
} from '../editor/recentPosition';
import { TitlePagePanel } from './TitlePagePanel';
import { FindPanel } from './FindPanel';
import { FindController } from '../application/find';
import { highlightFind } from '../editor/find';
import { ScriptCheckPanel } from './ScriptCheckPanel';
import {
  ScriptCheckController,
  visibleIssues,
} from '../application/scriptCheck';
import { highlightCheckIssues } from '../editor/scriptCheck';
import { navigateOutline } from '../editor/outlineNavigation';
import type { CapturedSnapshot } from '../application/persistenceController';
import type { DocumentEntryPort } from '../application/documentEntry';
import type { DocumentPort } from '../application/documents';
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
  editorRecovery,
  metadataSelection,
} from '../application/editorMetadata';
import { mountScreenplayEditor } from '../editor/view';
import { executeEditorCommand } from '../editor/shortcuts';
import { dispatchIsolated } from '../editor/formatting';
import { createCompletionPopup } from './CompletionPopup';
import { EditorControls } from './EditorControls';
import { ProtectedClosePanel } from './ProtectedClosePanel';
import { RecoveryChoicePanel } from './RecoveryChoicePanel';
import { SnapshotPanel } from './SnapshotPanel';
import { createFountainImportPanel } from './FountainImportPanel';
import { useFindSession } from './findSession';
import { useCheckSession } from './checkSession';
import { useSpellingSession } from './spellingSession';
import { useTitleSession } from './titleSession';
import { useMoveSession } from './moveSession';
import { useOutlineSession } from './outlineSession';
import { usePaletteSession } from './paletteSession';
import { usePublicationSession } from './publicationSession';
import {
  clampedSelection,
  toSessionSelection,
  writingFailureMessage,
} from './writingHelpers';
import type { CheckpointRequest } from '../application/documents';

import type {
  RecentProjectsPort,
  LocateSelection,
  LocateChoice,
} from '../application/recentProjects';

export interface WritingPorts {
  entry: DocumentEntryPort;
  documents: DocumentPort;
  externalSource?: import('../application/documents').ExternalSourcePort;
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  choices: RecoveryChoicesPort;
  recovery: RecoveryPort;
  publication?: import('../application/publication').PublicationPreviewPort;
  exportPdf?: import('../application/exportPdf').ExportPdfPort;
  exportAssessment?: import('../application/exportAssessment').ExportAssessmentPort;
  workflows: import('../application/workflowProtection').WorkflowProtectionPort;
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

export function WritingView({
  ports,
  open,
  onSessionClosed,
  onOpenRequested,
  recents,
  preferences: providedPreferences,
  registry: providedRegistry,
  spelling = '__TAURI_INTERNALS__' in window
    ? nativeSpellcheck
    : unavailableSpellcheck,
}: {
  ports: WritingPorts;
  preferences?: ViewPreferences;
  registry?: ShortcutRegistry;
  spelling?: SpellcheckPort;
  recents?: RecentProjectsPort;
  open: OpenRequest;
  onSessionClosed: (message?: string) => void;
  onOpenRequested?: () => void;
}) {
  const preferences = useMemo(
    () => providedPreferences ?? localViewPreferences(),
    [providedPreferences],
  );
  const presentation = usePresentation(preferences);
  const presentationBlocked = useRef(false);
  const typewriter = useMemo(
    () =>
      new TypewriterScroll(
        () => preferences.getSnapshot().settings.typewriter,
        () => presentationBlocked.current,
      ),
    [preferences],
  );
  useEffect(() => () => typewriter.destroy(), [typewriter]);
  const registry = useMemo(
    () =>
      providedRegistry ??
      localShortcutRegistry(/Mac/.test(navigator.platform) ? 'mac' : 'other'),
    [providedRegistry],
  );
  const editorHost = useRef<HTMLDivElement | null>(null);
  const stagedImportRef = useRef('');
  const titleDraftRef = useRef(false);
  const titleComposingRef = useRef(false);
  const titleApplyingRef = useRef(false);
  const checkVisibleRef = useRef(false);
  const [showCheck, updateShowCheck] = useState(false);
  const setShowCheck = (show: boolean) => {
    checkVisibleRef.current = show;
    updateShowCheck(show);
  };
  const importHost = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const popupRef = useRef<ReturnType<typeof createCompletionPopup> | null>(
    null,
  );
  const boundaryRef = useRef<EditorCaptureBoundary | null>(null);
  const frozenRef = useRef(false);
  const writableRef = useRef(true);
  const readyRef = useRef(false);
  const recoveryPendingRef = useRef(false);
  const editableRef = useMemo(
    () => ({
      get current() {
        return writableRef.current && !recoveryPendingRef.current;
      },
    }),
    [],
  );
  const adoptingRef = useRef(false);
  const windowCloseRef = useRef(false);
  const closeRequestedRef = useRef(false);
  const operationRef = useRef(false);
  const pendingSwitchRef = useRef(false);
  const sessionRef = useRef<WritingSession | null>(null);
  const [phase, setPhase] = useState<'opening' | 'active' | 'failed'>(
    'opening',
  );
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActiveInfo | null>(null);
  const [status, setStatus] = useState('');
  const [saveDetails, setSaveDetails] = useState('');
  const [snapshotAttention, setSnapshotAttention] = useState(false);
  const [onlyInMemory, setOnlyInMemory] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [externalNotice, setExternalNotice] = useState('');
  const externalSeenRef = useRef('');
  const [live, setLive] = useState<CapturedSnapshot | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [closeWorking, setCloseWorking] = useState(false);
  const [paletteRequested, requestPalette] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandComposing, setCommandComposing] = useState(false);
  useEffect(() => {
    const start = () => setCommandComposing(true);
    const end = () => setCommandComposing(false);
    window.addEventListener('compositionstart', start);
    window.addEventListener('compositionend', end);
    return () => {
      window.removeEventListener('compositionstart', start);
      window.removeEventListener('compositionend', end);
    };
  }, []);
  const [copyDestination, setCopyDestination] =
    useState<CopyDestination | null>(null);
  const [candidates, setCandidates] = useState<RecoveryCandidate[]>([]);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryChoiceCompleted, setRecoveryChoiceCompleted] = useState(false);
  const [recoveryDiscoveryFailed, setRecoveryDiscoveryFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeCheck = () => {
    setShowCheck(false);
    const view = viewRef.current;
    if (view && !view.isDestroyed) highlightCheckIssues(view, null, []);
    if (view && !view.isDestroyed && !view.composing) {
      view.dom.focus({ preventScroll: true });
      view.focus();
    }
  };
  const {
    findRef,
    findState,
    setFindState,
    replaceMessage,
    openFind,
    navigateSearch,
    closeFind,
    replaceOne,
    replaceAll,
  } = useFindSession({
    viewRef,
    popupRef,
    operationRef,
    frozenRef,
    readyRef,
    titleDraftRef,
    titleComposingRef,
    writableRef: editableRef,
    showClose,
    busy,
    active,
    setError,
    closeCheck,
  });
  const { checkRef, checkState, setCheckState, openCheck, navigateIssue } =
    useCheckSession({
      findRef,
      viewRef,
      popupRef,
      operationRef,
      frozenRef,
      readyRef,
      showClose,
      titleDraftRef,
      titleComposingRef,
      setShowCheck,
      setError,
    });
  const { spellingRef, showSpelling, openSpelling, closeSpelling } =
    useSpellingSession({
      viewRef,
      popupRef,
    });
  const { showTitle, titleButtonRef, openTitle, closeTitle } = useTitleSession({
    popupRef,
  });
  useEffect(() => {
    restorePreviewFocus();
  });
  const {
    outline,
    setOutline,
    character,
    setCharacter,
    characterHighlight,
    setCharacterHighlight,
    positions,
    positionError,
    setPositionError,
    positionRemember,
    positionClosing,
    positionCloseHint,
    positionRestore,
    retainClosingPosition,
    onOutlineNavigate,
    navigateCharacter,
  } = useOutlineSession({
    viewRef,
    readyRef,
    frozenRef,
    operationRef,
    titleDraftRef,
    titleComposingRef,
    phase,
    setError,
  });

  useEffect(() => {
    // Moving the retained editor host from Opening to Writing can clear WebKit's
    // DOM selection/focus while EditorState still holds the exact restored caret.
    const view = viewRef.current;
    if (
      phase === 'active' &&
      view &&
      !view.isDestroyed &&
      !view.composing &&
      document.activeElement === document.body
    ) {
      view.dom.focus({ preventScroll: true });
      view.focus();
    }
  }, [phase]);

  useEffect(() => {
    const header = editorHost.current
      ?.closest('main')
      ?.querySelector('.writing-presentation');
    if (!header) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    const measure = () => {
      root.style.scrollPaddingTop = `${header.getBoundingClientRect().height + 8}px`;
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(header);
    return () => {
      observer?.disconnect();
      root.style.scrollPaddingTop = previous;
    };
  }, [phase]);

  const refresh = () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      setActive(session.active);
      const described = session.cadenceStatus;
      setStatus(described.status);
      setSnapshotAttention(described.snapshotAttention);
      setOnlyInMemory(session.close.assessment.onlyInMemory);
      setSaveDetails(
        `Live version ${described.liveVersion}. Recovery: journaled version ${described.journaledVersion}. ` +
          `Source file: ${described.status} (saved version ${described.fileSavedVersion}). ` +
          `Snapshots: ${described.snapshotAttention ? 'need attention' : 'healthy'}` +
          (described.lastRollingVersion !== null
            ? `, last rolling version ${described.lastRollingVersion}`
            : ', no rolling snapshot yet') +
          '.',
      );
    } catch {
      // Session retired; the closing path owns the UI from here.
    }
  };

  const {
    move,
    moveMessage,
    moveBusy,
    moveAbortRef,
    previewMove,
    applyMove,
    cancelMove,
  } = useMoveSession({
    viewRef,
    operationRef,
    frozenRef,
    readyRef,
    writableRef: editableRef,
    sessionRef,
    outline,
    busy,
    setBusy,
    refresh,
    setError,
  });
  useEffect(() => {
    let alive = true;
    let capturing = false;
    let captureAgain = false;
    let captureAlert: string | undefined;
    let initialPositionEligible = true;
    let positionCapture:
      | (import('../application/manuscriptProjection').ManuscriptStamp & {
          readonly sourceSha256: string;
        })
      | null = null;
    let positionTimer: ReturnType<typeof setTimeout> | null = null;
    const rememberPosition = (closing = false) => {
      positionTimer = null;
      const active = sessionRef.current?.active,
        view = viewRef.current;
      const current = positionCapture;
      if (
        !alive ||
        !readyRef.current ||
        positionRestore.current ||
        (positionClosing.current && !closing) ||
        !active?.persistentIdentity ||
        active.kind === 'unsaved' ||
        !view ||
        !current ||
        current.doc !== view.state.doc ||
        current.session !== editorOrigin(view.state).session
      )
        return;
      // Identical immutable content retains its branded hash across selection-only
      // changes, even when a new advisory projection is still queued.
      const hint = captureRecentPosition(
        view,
        { ...current, version: editorVersion(view.state) },
        active.identity.documentId,
      );
      if (hint) {
        const prior = positionCloseHint.current;
        const stored = closing
          ? {
              ...hint,
              viewport:
                prior?.documentId === hint.documentId &&
                prior.sourceSha256 === hint.sourceSha256
                  ? prior.viewport
                  : null,
            }
          : hint;
        if (!closing) positionCloseHint.current = hint;
        positions.remember(stored);
        setPositionError(positions.error);
      }
    };
    positionRemember.current = rememberPosition;
    const schedulePosition = () => {
      if (positionTimer !== null) return;
      positionTimer = setTimeout(rememberPosition, 250);
    };
    const cancelPositionRestore = () => {
      positionRestore.current = null;
    };
    const disposePosition = () => {
      if (positionTimer !== null) clearTimeout(positionTimer);
      rememberPosition();
      window.removeEventListener('scroll', schedulePosition);
      window.removeEventListener('pointerdown', cancelPositionRestore, true);
      window.removeEventListener('keydown', cancelPositionRestore, true);
      window.removeEventListener('wheel', cancelPositionRestore, true);
      window.removeEventListener('touchstart', cancelPositionRestore, true);
    };
    window.addEventListener('scroll', schedulePosition, { passive: true });
    window.addEventListener('pointerdown', cancelPositionRestore, true);
    window.addEventListener('keydown', cancelPositionRestore, true);
    window.addEventListener('wheel', cancelPositionRestore, {
      capture: true,
      passive: true,
    });
    window.addEventListener('touchstart', cancelPositionRestore, {
      capture: true,
      passive: true,
    });
    const stamp = () => {
      const view = viewRef.current;
      return view && !view.isDestroyed
        ? {
            ...stampOf(view.state),
          }
        : null;
    };
    const preview = ports.publication
      ? new PublicationPreviewController(
          ports.publication,
          () => {
            const currentStamp = stamp(),
              active = sessionRef.current?.active;
            return readyRef.current && currentStamp && active
              ? { stamp: currentStamp, identity: active.identity }
              : null;
          },
          (state) => {
            if (alive) setPreviewState(state);
          },
        )
      : null;
    previewRef.current = preview;
    const exporter =
      preview && ports.exportPdf && ports.exportAssessment
        ? new ExportPdfController(
            ports.exportPdf,
            ports.exportAssessment,
            preview,
            (state) => {
              if (alive) setExportState(state);
            },
          )
        : null;
    exportRef.current = exporter;
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
    const check = new ScriptCheckController(
      stamp,
      (state) => {
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
            checkVisibleRef.current && state.phase === 'current'
              ? state.projection
              : null,
            visibleIssues(state),
          );
      },
      ports.exportAssessment,
    );
    checkRef.current = check;
    const projection = new ManuscriptProjectionController(stamp, (state) => {
      if (alive) setOutline(state);
      if (state.phase === 'current') schedulePosition();
      find.setProjection(
        state,
        viewRef.current?.state.selection.$head.index(0) ?? -1,
      );
      check.setProjection(state);
      preview?.accept(state);
    });
    let navigationCapture = false;
    const changed = (
      _state?: import('prosemirror-state').EditorState,
      transaction?: import('prosemirror-state').Transaction,
    ) => {
      spellingRef.current?.invalidate();
      preview?.invalidate();
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
              // The draft is capturable again: retire only our own alert.
              const stale = captureAlert;
              captureAlert = undefined;
              if (stale !== undefined && alive)
                setError((current) => (current === stale ? '' : current));
            } catch (failure) {
              if (!captureAgain && alive) {
                captureAlert =
                  failure instanceof Error
                    ? failure.message
                    : 'Edit could not be recorded';
                setError(captureAlert);
              }
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
      preview?.invalidate();
      spellingRef.current?.invalidate();
      writableRef.current = writable;
      typewriter.destroy();
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
            !recoveryPendingRef.current &&
            !frozenRef.current &&
            ((!titleDraftRef.current && !titleComposingRef.current) ||
              titleApplyingRef.current)),
        canNavigate: () => readyRef.current && !frozenRef.current,
        escapeFocus: () => {
          const main = host.closest('main');
          const target =
            main?.querySelector<HTMLElement>('#writing-save:not(:disabled)') ??
            main?.querySelector<HTMLElement>('.actions button:not(:disabled)');
          target?.focus();
        },
        escapePresentation: () => {
          if (
            !preferences.getSnapshot().settings.focus ||
            presentationBlocked.current
          )
            return false;
          if (preferences.update({ focus: false })) viewRef.current?.focus();
          return true;
        },
        changed,
        presentationChanged: (current, tr) => typewriter.changed(current, tr),
        scrollToSelection: (current) => {
          const header = host
            .closest('main')
            ?.querySelector('.writing-presentation');
          if (!header || current.composing) return false;
          const edge = header.getBoundingClientRect().bottom + 8;
          const caret = current.coordsAtPos(current.state.selection.head);
          if (caret.top >= edge) return false;
          window.scrollBy({ top: caret.top - edge, behavior: 'instant' });
          return true;
        },
      });
      typewriter.attach(view);
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
        const restoreHint = initialPositionEligible;
        initialPositionEligible = false;
        positionRestore.current = null;
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
          else {
            const active = sessionRef.current?.active;
            if (
              restoreHint &&
              !metadata &&
              open.kind !== 'recovered' &&
              open.kind !== 'located' &&
              active?.persistentIdentity &&
              active.fingerprint &&
              active.kind !== 'unsaved'
            ) {
              const hint = positions.find(
                active.identity.documentId,
                active.fingerprint.sha256,
              );
              if (alive) setPositionError(positions.error);
              const selection =
                hint &&
                recentSelection(
                  state,
                  hint,
                  active.identity.documentId,
                  active.fingerprint.sha256,
                );
              if (hint && selection) {
                state = state.apply(state.tr.setSelection(selection));
                positionRestore.current = { hint, state };
              }
            }
          }
        }
        installState(state, writable);
      },
      retain() {
        const state = viewRef.current?.state;
        const writable = writableRef.current;
        if (!state) throw new Error('Editor unavailable');
        return () => {
          installState(state, writable);
          // Rollback restores the editor but invalidates the adopted view's
          // derived facts. Re-capture the restored session before navigation.
          changed();
        };
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
            positionCapture = {
              ...capturedStamp,
              sourceSha256: result.snapshot.sourceSha256,
            };
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
            sameStamp(current, started)
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
        const frozenView = viewRef.current;
        viewRef.current?.setProps({});
        return () => {
          frozenRef.current = false;
          const current = viewRef.current;
          if (current && !current.isDestroyed) {
            current.setProps({});
            // Save As/rollback can install a new view while it is noneditable.
            // Sync its retained selection after thaw, when WebKit can own it.
            if (current !== frozenView && !current.composing) {
              current.dom.focus({ preventScroll: true });
              current.focus();
            }
          }
        };
      },
      advanceVersion(version) {
        const view = viewRef.current;
        if (!view) throw new Error('Editor unavailable');
        adoptingRef.current = true;
        try {
          dispatchIsolated(view, advanceEditorVersion(view.state, version));
        } finally {
          adoptingRef.current = false;
        }
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
        externalSource: ports.externalSource,
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
        if (session.active.fingerprint) {
          recoveryPendingRef.current = true;
          setRecoveryPending(true);
          try {
            const entry = await ports.recovery.inspect(session.active.identity);
            if (!alive) return;
            if (entry.documentId !== session.active.identity.documentId)
              throw new Error('Recovery identity mismatch');
            setCandidates([...entry.candidates]);
            recoveryPendingRef.current =
              !!entry.error ||
              entry.notices.length > 0 ||
              (entry.candidates.length > 0 && entry.reconciled !== true);
            setRecoveryPending(recoveryPendingRef.current);
          } catch {
            if (!alive) return;
            setRecoveryDiscoveryFailed(true);
            setError(
              'Recovery could not be checked. Review remains available; return Home and reopen before editing.',
            );
          }
        }
        readyRef.current = true;
        viewRef.current?.setProps({});
        setPhase('active');
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
    let stop: (() => void) | undefined;
    if ('__TAURI_INTERNALS__' in window) {
      void listen('protected-close-requested', () => {
        if (alive) requestClose(false, true);
      }).then(
        (stopListening) => {
          if (alive) stop = stopListening;
          else stopListening();
        },
        () => undefined,
      );
    }
    return () => {
      disposePosition();
      alive = false;
      moveAbortRef.current?.abort();
      exporter?.dispose();
      exportRef.current = null;
      preview?.dispose();
      previewRef.current = null;
      projection.dispose();
      find.dispose();
      findRef.current = null;
      checkRef.current?.dispose();
      checkRef.current = null;
      stop?.();
      typewriter.destroy();
      popupRef.current?.destroy();
      viewRef.current?.destroy();
      session.dispose();
    };
    // One session per mounted view; panels refresh through status state.
  }, []);

  useEffect(() => {
    if (phase !== 'active' || !ports.externalSource) return;
    let alive = true;
    const check = () => {
      if (
        operationRef.current ||
        frozenRef.current ||
        window.document.visibilityState === 'hidden'
      )
        return;
      void sessionRef.current?.checkExternalSource().then(
        () => {
          if (!alive) return;
          setExternalNotice('');
          const review = sessionRef.current?.externalChange;
          const key = review
            ? JSON.stringify([review.identity, review.fingerprint])
            : '';
          if (key && key !== externalSeenRef.current) setShowExternal(true);
          externalSeenRef.current = key;
          refresh();
        },
        () => {
          if (alive)
            setExternalNotice(
              'Source recheck unavailable. Keep editing; recovery and separate copies remain available. Retry Check external changes.',
            );
        },
      );
    };
    let stopNative: (() => void) | undefined;
    if ('__TAURI_INTERNALS__' in window) {
      void listen('source-recheck-requested', check).then(
        (stop) => {
          if (alive) stopNative = stop;
          else stop();
        },
        () => {
          if (alive)
            setExternalNotice(
              'Window focus recheck unavailable; periodic checks remain active.',
            );
        },
      );
    }
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 5000);
    check();
    return () => {
      alive = false;
      window.removeEventListener('focus', check);
      stopNative?.();
      window.clearInterval(timer);
    };
  }, [phase, ports.externalSource]);

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
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !viewRef.current?.composing &&
        preferences.getSnapshot().settings.focus &&
        !showClose &&
        !paletteOpen &&
        !showTitle &&
        !findState?.enabled &&
        !showCheck &&
        !(
          target instanceof HTMLElement &&
          target.closest('input, select, textarea')
        )
      ) {
        event.preventDefault();
        if (preferences.update({ focus: false })) viewRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    busy,
    showClose,
    showTitle,
    showCheck,
    findState?.enabled,
    paletteOpen,
    registry,
    preferences,
  ]);

  useEffect(() => {
    if (
      !importHost.current ||
      !active ||
      active.readOnly ||
      recoveryPending ||
      phase !== 'active'
    )
      return;
    const view = viewRef.current;
    if (!view) return;
    const boundary = new FountainImportBoundary(
      () => view,
      (apply, signal) => {
        if (!editableRef.current)
          throw new Error('Choose recovery before importing.');
        return sessionRef.current!.runProtectedWorkflow(
          'fountainImport',
          apply,
          signal,
        );
      },
    );
    const panel = createFountainImportPanel(importHost.current, boundary);
    panel.input.value = stagedImportRef.current;
    return () => {
      stagedImportRef.current = panel.input.value;
      panel.destroy();
    };
  }, [
    ports.workflows,
    recoveryPending,
    editableRef,
    active?.identity.documentId,
    active?.identity.handle,
    phase,
  ]);

  const run = async (action: () => Promise<unknown>, duringExport = false) => {
    if (exportRef.current?.busy && !duringExport) {
      setError(
        'Finish or cancel PDF export before this action. Editing and Save remain available.',
      );
      return;
    }
    if (titleDraftRef.current || titleComposingRef.current) {
      setError(
        'Apply or Discard the uncommitted title input before saving or leaving.',
      );
      return;
    }
    if (operationRef.current || frozenRef.current) {
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

  const finishClose = (session: WritingSession) => {
    if (sessionRef.current !== session || !session.active) return;
    positionRemember.current(true);
    session.finishClose();
    setShowClose(false);
    closeRequestedRef.current = false;
    if (windowCloseRef.current) {
      void getCurrentWindow()
        .close()
        .catch(() =>
          setError(
            'The document is protected, but the window could not close. Try closing again.',
          ),
        );
    } else if (pendingSwitchRef.current && onOpenRequested) onOpenRequested();
    else onSessionClosed();
  };

  const requestClose = (switching = false, windowClose = false) => {
    const session = sessionRef.current;
    if (closeRequestedRef.current) return;
    if (!readyRef.current || !session?.active || operationRef.current) {
      setError('Close waits until the current writing action finishes.');
      return;
    }
    if (exportRef.current?.busy) {
      setError('Finish or cancel PDF export before leaving this screenplay.');
      return;
    }
    if (titleDraftRef.current || titleComposingRef.current) {
      setError(
        'Apply or Discard the uncommitted title input before leaving the screenplay.',
      );
      return;
    }
    closeRequestedRef.current = true;
    windowCloseRef.current = windowClose;
    pendingSwitchRef.current = switching;
    retainClosingPosition();
    setShowClose(true);
    if (!session.active.fingerprint && !session.active.readOnly) return;
    operationRef.current = true;
    setCloseWorking(true);
    setBusy(true);
    void session.close
      .retry()
      .then(() => finishClose(session))
      .catch(() => {
        // ProtectedClose owns the persistent exact-protection assessment.
        // Its failure path thaws the retained editor; no automatic risk choice.
      })
      .finally(() => {
        operationRef.current = false;
        setBusy(false);
        setCloseWorking(false);
        refresh();
      });
  };

  const reportOutcome = (
    outcome: { status: string; fileName?: string },
    changedIdentity = false,
  ) => {
    if (outcome.status === 'cancelled')
      setError('The native dialog was cancelled. Nothing changed.');
    else if (outcome.fileName) {
      setError('');
      if (outcome.status === 'published') {
        setCopyDestination(null);
        if (changedIdentity) {
          setCandidates([]);
          recoveryPendingRef.current = false;
          setRecoveryPending(false);
          setRecoveryChoiceCompleted(false);
          setRecoveryDiscoveryFailed(false);
          viewRef.current?.setProps({});
        }
      }
    }
    refresh();
  };

  const exclusive = async <T,>(action: () => Promise<T>): Promise<T> => {
    if (operationRef.current)
      throw new Error('Another writing action is pending');
    operationRef.current = true;
    try {
      return await action();
    } finally {
      operationRef.current = false;
      refresh();
    }
  };

  const snapshotPort = useMemo<SnapshotPort>(
    () => ({
      ...ports.snapshots,
      restore: async (request) =>
        exclusive(async () => {
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
        }),
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
      keep: async (request) => exclusive(() => ports.choices.keep(request)),
      recover: async (request) =>
        exclusive(async () => {
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
        }),
      resolve: async (identity) =>
        exclusive(async () => {
          return await sessionRef.current!.resolveNative(() =>
            ports.choices.resolve(identity),
          );
        }),
    };
  }, [ports]);

  const recoveryChosen = () => {
    recoveryPendingRef.current = false;
    setRecoveryPending(false);
    setRecoveryChoiceCompleted(true);
    viewRef.current?.setProps({});
    // Re-enter through the owned view so the retained caret is synchronized.
    viewRef.current?.focus();
    refresh();
  };
  const orderedRecovery = [...candidates].sort(
    (a, b) => b.generation - a.generation,
  );
  const recoveryPanel = (candidate: RecoveryCandidate) =>
    active?.fingerprint && (
      <RecoveryChoicePanel
        key={`${active.identity.handle}:${candidate.selection.origin}:${candidate.selection.recordSha256}`}
        port={choicePort}
        readOnly={active.readOnly}
        identity={active.identity}
        selection={candidate.selection}
        expectedFingerprint={active.fingerprint}
        nextVersion={Math.max(
          active.liveVersion + 1,
          ...candidates.map((item) => item.version + 1),
        )}
        onKept={recoveryChosen}
        onRecovered={recoveryChosen}
        onInspectLater={() => viewRef.current?.focus()}
        onResolved={() => {
          void ports.recovery
            .inspect(active.identity)
            .then((entry) => {
              if (
                sessionRef.current?.active?.identity.handle !==
                active.identity.handle
              )
                return;
              if (entry.reconciled) recoveryChosen();
              else refresh();
            })
            .catch(() => refresh());
        }}
      />
    );

  // The editor and import hosts are keyed so React preserves their DOM across
  // phase changes. Unkeyed conditional trees unmounted ProseMirror's DOM out
  // from under the live view, silently detaching the editor.
  const commandContext = (): CommandContext => {
    const current = viewRef.current;
    const projection = outline.projection;
    const currentProjection =
      !!current &&
      !!projection &&
      outline.phase === 'current' &&
      isCurrent(current.state, projection);
    return {
      route: 'writing',
      native: true,
      ready:
        phase === 'active' && readyRef.current && !!sessionRef.current?.active,
      blocked:
        operationRef.current || frozenRef.current || showClose || Boolean(move),
      composing:
        commandComposing || !!current?.composing || titleComposingRef.current,
      staged: titleDraftRef.current,
      readOnly: !editableRef.current,
      form: false,
      undo: !!current && undoDepth(current.state) > 0,
      redo: !!current && redoDepth(current.state) > 0,
      navigation:
        currentProjection &&
        !!projection?.index.items.some((item) => item.kind === 'scene'),
      matches:
        !!findRef.current?.state.matches.length &&
        findRef.current.state.phase === 'current',
      exporting: exportRef.current?.busy ?? false,
      pdfAvailable: !!exportRef.current,
      sourceCheckAvailable:
        !!ports.externalSource && !!sessionRef.current?.active?.fingerprint,
    };
  };
  const commandUnavailable = (id: string) => {
    const command = shortcutCommands.find((entry) => entry.id === id);
    return command
      ? commandReason(command, commandContext())
      : 'Unknown command.';
  };
  const executeCommand = (id: string) =>
    dispatchCommand(id, commandContext(), (known) => {
      const current = viewRef.current,
        currentSession = sessionRef.current;
      if (!current || !currentSession) return;
      switch (known) {
        case 'commandPalette':
          popupRef.current?.controller.dismiss();
          requestPalette((n) => n + 1);
          break;
        case 'checkExternal':
          void run(async () => {
            await currentSession.checkExternalSource();
            setShowExternal(!!currentSession.externalChange);
            setExternalNotice(
              currentSession.externalChange
                ? ''
                : 'No external content change detected.',
            );
            refresh();
          });
          break;
        case 'reloadSource':
          if (currentSession.externalChange) setShowExternal(true);
          else
            void run(async () => {
              await currentSession.checkExternalSource();
              setShowExternal(!!currentSession.externalChange);
            });
          break;
        case 'save':
          void run(() => currentSession.save().then(() => refresh()), true);
          break;
        case 'exportPdf':
          if (ports.exportPdf)
            void exportRef.current?.start(() =>
              currentSession.captureForPdf((cp) =>
                ports.exportPdf!.prepare(cp),
              ),
            );
          break;
        case 'saveAs': {
          const before = currentSession.active?.identity.handle;
          void run(() =>
            currentSession
              .saveAs()
              .then((outcome) =>
                reportOutcome(
                  outcome,
                  currentSession.active?.identity.handle !== before,
                ),
              ),
          );
          break;
        }
        case 'exportFountain':
          void run(() =>
            currentSession
              .exportCopy()
              .then((outcome) => reportOutcome(outcome)),
          );
          break;
        case 'open':
          requestClose(true);
          break;
        case 'home':
        case 'closeSession':
          requestClose();
          break;
        case 'find':
        case 'replace':
          openFind();
          break;
        case 'nextMatch':
        case 'previousMatch':
          navigateSearch(known === 'nextMatch' ? 1 : -1);
          break;
        case 'scriptCheck':
          openCheck();
          break;
        case 'spellcheck':
          openSpelling();
          break;
        case 'titlePage':
          openTitle();
          break;
        case 'focusMode':
          preferences.update({
            focus: !preferences.getSnapshot().settings.focus,
          });
          break;
        case 'characters':
        case 'outline': {
          if (
            preferences.getSnapshot().settings.focus &&
            !preferences.update({ focus: false })
          )
            break;
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(
                known === 'characters'
                  ? '[aria-label="Character focus"]'
                  : '.manuscript-outline input',
              )
              ?.focus(),
          );
          break;
        }
        case 'nextScene':
        case 'previousScene': {
          const projection = outline.projection;
          if (!projection) break;
          const row = current.state.selection.$head.index(0);
          const scenes = projection.index.items.filter(
            (item) => item.kind === 'scene',
          );
          const target =
            known === 'nextScene'
              ? (scenes.find((item) => item.row > row) ?? scenes[0])
              : ([...scenes].reverse().find((item) => item.row < row) ??
                scenes.at(-1));
          if (target) navigateOutline(current, projection, target.row);
          break;
        }
        default:
          executeEditorCommand(current, known, (reason) =>
            setError(reason ?? 'Edit refused'),
          );
          refresh();
      }
    });
  const { paletteNavigation } = usePaletteSession({
    outline,
    viewRef,
    getFacts: commandContext,
    setError,
  });
  const {
    previewRef,
    exportRef,
    exportState,
    setExportState,
    previewButton,
    previewState,
    setPreviewState,
    restorePreviewFocus,
    openPreview,
    closePreview,
    dismissExport,
  } = usePublicationSession({ outline });

  const hosts = (
    <div key="writing-hosts">
      {phase === 'active' &&
        exportState &&
        exportState.phase !== 'idle' &&
        exportRef.current && (
          <ExportPdfPanel
            key={exportState.version ?? 'capture'}
            controller={exportRef.current}
            state={exportState}
            onDismiss={dismissExport}
          />
        )}
      {phase === 'active' && previewState?.enabled && previewRef.current && (
        <PublicationPreview
          controller={previewRef.current}
          state={previewState}
          onClose={closePreview}
        />
      )}
      {phase === 'active' && showSpelling && (
        <SpellcheckPanel
          port={spelling}
          getView={() => viewRef.current}
          blocked={() =>
            operationRef.current ||
            frozenRef.current ||
            !readyRef.current ||
            titleDraftRef.current ||
            titleComposingRef.current ||
            Boolean(showClose)
          }
          readOnly={() => !editableRef.current}
          onController={(controller) => {
            spellingRef.current = controller;
          }}
          onClose={closeSpelling}
        />
      )}
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
            !editableRef.current ||
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
          readOnly={Boolean(active?.readOnly) || recoveryPending}
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
              !editableRef.current ||
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
          onClose={closeTitle}
        />
      )}
      {phase === 'active' && (
        <CharacterPanel
          state={outline}
          selected={character}
          highlight={characterHighlight}
          disabled={
            busy ||
            showClose ||
            frozenRef.current ||
            titleDraftRef.current ||
            titleComposingRef.current
          }
          onSelect={setCharacter}
          onHighlight={setCharacterHighlight}
          onNavigate={navigateCharacter}
        />
      )}
      {positionError && <p role="status">{positionError}</p>}
      {phase === 'active' && (
        <Outline
          state={outline}
          disabled={busy || showClose}
          moveDisabled={
            Boolean(active?.readOnly) || recoveryPending || Boolean(move)
          }
          onMove={previewMove}
          onNavigate={onOutlineNavigate}
        />
      )}
      {move && (
        <MovePreview
          move={move}
          stale={viewRef.current?.state !== move.state}
          busy={moveBusy}
          message={moveMessage}
          onApply={() => void applyMove()}
          onCancel={cancelMove}
        />
      )}
      <div
        ref={editorHost}
        aria-label="Screenplay editor"
        style={{ fontSize: `${presentation.settings.zoom / 100}rem` }}
      />
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

  presentationBlocked.current =
    busy ||
    showClose ||
    showTitle ||
    Boolean(move) ||
    Boolean(findState?.enabled) ||
    showCheck;
  const modeDisabled =
    busy || showClose || Boolean(view?.composing) || titleComposingRef.current;
  return (
    <main
      className={`shell writing${presentation.settings.focus ? ' writing-focus' : ''}${presentation.settings.typewriter ? ' writing-typewriter' : ''}`}
    >
      <div className="writing-presentation">
        <PresentationControls
          preferences={preferences}
          writing
          disabled={modeDisabled}
          canChange={() =>
            !operationRef.current &&
            !viewRef.current?.composing &&
            !titleComposingRef.current
          }
        />
        <section aria-label="Protection status">
          <p role="status">
            {closeWorking
              ? 'Closing safely…'
              : status || 'Protection status unavailable.'}
          </p>
          {snapshotAttention && <p role="alert">Snapshots need attention.</p>}
          {onlyInMemory && (
            <p role="alert">
              Newer changes exist only in memory until protection is confirmed.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <details>
            <summary>Save details</summary>
            <p>{saveDetails}</p>
          </details>
        </section>
      </div>
      <CommandSurface
        registry={registry}
        context={commandContext}
        execute={executeCommand}
        navigation={paletteNavigation}
        paletteRequested={paletteRequested}
        onPaletteChange={setPaletteOpen}
      />
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
      {externalNotice && <p role="status">{externalNotice}</p>}
      {session?.externalChange && showExternal && (
        <section aria-label="External source change">
          <h2>External source change</h2>
          <p>
            {session.externalDirty
              ? 'Your draft and the source file differ.'
              : 'The source file changed outside Babel.'}{' '}
            Reload keeps a safety snapshot and revision of your draft before
            adopting the reviewed file. You can Undo Reload.
          </p>
          <SourceComparison
            draft={live?.source ?? []}
            disk={session.externalChange.source ?? []}
          />
          <button
            type="button"
            disabled={modeDisabled || !!commandUnavailable('reloadSource')}
            onClick={() =>
              void run(async () => {
                await session.reloadExternalSource();
                setShowExternal(false);
                refresh();
              })
            }
          >
            Reload reviewed source
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowExternal(false)}
          >
            Keep editing
          </button>
          <button
            type="button"
            disabled={!!commandUnavailable('saveAs')}
            onClick={() => executeCommand('saveAs')}
          >
            Save draft as a separate copy
          </button>
          <p>
            Source saves stay blocked until Reload or Save As. The outside file
            is kept intact.
          </p>
        </section>
      )}
      <div className="actions" aria-label="Screenplay actions">
        <button
          type="button"
          disabled={
            !!commandUnavailable('checkExternal') ||
            !ports.externalSource ||
            active?.kind === 'unsaved' ||
            active?.readOnly
          }
          onClick={() => executeCommand('checkExternal')}
        >
          Check external changes
        </button>
        <button
          type="button"
          disabled={
            !!commandUnavailable('reloadSource') || !session?.externalChange
          }
          onClick={() => executeCommand('reloadSource')}
        >
          Reload source
        </button>
        <button
          id="writing-save"
          type="button"
          disabled={!!commandUnavailable('save')}
          onClick={() => executeCommand('save')}
        >
          {active?.kind === 'unsaved' ? 'Protect draft' : 'Save'}
        </button>
        <button
          type="button"
          disabled={!!commandUnavailable('saveAs')}
          onClick={() => executeCommand('saveAs')}
        >
          Save As
        </button>
        <button
          type="button"
          disabled={!!commandUnavailable('exportFountain')}
          onClick={() => executeCommand('exportFountain')}
        >
          Export Fountain copy
        </button>
        <button
          type="button"
          disabled={!!commandUnavailable('exportPdf')}
          onClick={() => executeCommand('exportPdf')}
        >
          Export PDF
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
          disabled={!!commandUnavailable('find')}
          onClick={() => executeCommand('find')}
        >
          Find
        </button>
        <button
          type="button"
          id="writing-spellcheck"
          aria-expanded={showSpelling}
          disabled={!!commandUnavailable('spellcheck')}
          onClick={() => executeCommand('spellcheck')}
        >
          Spellcheck
        </button>
        <button
          type="button"
          ref={previewButton}
          id="writing-preview"
          aria-expanded={previewState?.enabled ?? false}
          disabled={
            !ports.publication ||
            busy ||
            showClose ||
            !active ||
            titleDraftRef.current ||
            titleComposingRef.current ||
            commandComposing
          }
          onClick={openPreview}
        >
          PDF preview
        </button>
        <span role="status" aria-label="Publication page count">
          {previewState?.message ?? 'Pages: open PDF preview'}
        </span>
        <button
          type="button"
          id="writing-check"
          aria-expanded={showCheck}
          disabled={!!commandUnavailable('scriptCheck')}
          onClick={() => executeCommand('scriptCheck')}
        >
          Script Check
        </button>
        <button
          id="writing-title"
          ref={titleButtonRef}
          aria-expanded={showTitle}
          type="button"
          disabled={!!commandUnavailable('titlePage') || showTitle}
          onClick={() => executeCommand('titlePage')}
        >
          Title page
        </button>
        <button
          type="button"
          disabled={!!commandUnavailable('closeSession')}
          onClick={() => executeCommand('closeSession')}
        >
          Close session
        </button>
        <button
          type="button"
          disabled={!!commandUnavailable('home')}
          onClick={() => executeCommand('home')}
        >
          Home
        </button>
      </div>
      {view && (
        <EditorControls
          state={view.state}
          registry={registry}
          focusTargetLabel="screenplay actions"
          availability={commandUnavailable}
          execute={executeCommand}
        />
      )}
      {recoveryPending && (
        <p role="alert">
          Choose which draft to use before editing. Both drafts remain
          protected. Inspect later lets you read the screenplay without editing.
        </p>
      )}
      {recoveryDiscoveryFailed && (
        <p role="alert">
          Recovery review is unavailable. Return Home and reopen to retry.
        </p>
      )}
      {active && active.fingerprint && orderedRecovery.length > 0 && (
        <>
          {(recoveryPending || recoveryChoiceCompleted) &&
            recoveryPanel(orderedRecovery[0]!)}
          <details>
            <summary>
              Inspect{' '}
              {recoveryPending
                ? 'other recovery generations'
                : 'retained recovery'}
            </summary>
            {(recoveryPending || recoveryChoiceCompleted
              ? orderedRecovery.slice(1)
              : orderedRecovery
            ).map(recoveryPanel)}
          </details>
        </>
      )}
      {hosts}

      {session && session.active && showClose && !closeWorking && (
        <ProtectedClosePanel
          close={session.close}
          untitled={!session.active.fingerprint && !session.active.readOnly}
          statusToken={`${active?.liveVersion}:${saveDetails}:${onlyInMemory}`}
          destination={copyDestination ?? undefined}
          onCancel={() => {
            closeRequestedRef.current = false;
            windowCloseRef.current = false;
            pendingSwitchRef.current = false;
            setShowClose(false);
            viewRef.current?.focus();
          }}
          onClosed={() => finishClose(session)}
        />
      )}
      {active && !active.readOnly && !recoveryPending && checkpoint && (
        <SnapshotPanel
          port={snapshotPort}
          current={checkpoint}
          destination={copyDestination ?? undefined}
          nextVersion={active.liveVersion + 1}
          onRestored={() => refresh()}
        />
      )}
    </main>
  );
}
