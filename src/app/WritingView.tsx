import { PublicationPreview } from './PublicationPreview';
import { ExportPdfPanel } from './ExportPdfPanel';
import {
  ExportPdfController,
  type ExportPdfState,
} from '../application/exportPdf';
import {
  PublicationPreviewController,
  type PublicationPreviewState,
} from '../application/publicationPreview';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CharacterPanel } from './CharacterPanel';
import { highlightCharacter } from '../editor/characterFocus';
import {
  localRecentPositions,
  type RecentPosition,
} from '../application/recentPosition';
import {
  captureRecentPosition,
  recentSelection,
  restoreRecentViewport,
} from '../editor/recentPosition';
import type { OutlineItem } from '../domain/manuscriptIndex';
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
import { useFindSession } from './findSession';
import { useCheckSession } from './checkSession';
import { useSpellingSession } from './spellingSession';
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
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  choices: RecoveryChoicesPort;
  recovery: RecoveryPort;
  fountainImport: FountainImportPort;
  publication?: import('../application/publication').PublicationPreviewPort;
  exportPdf?: import('../application/exportPdf').ExportPdfPort;
  exportAssessment?: import('../application/exportAssessment').ExportAssessmentPort;
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
  const [showTitle, setShowTitle] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
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
  const previewRef = useRef<PublicationPreviewController | null>(null);
  const exportRef = useRef<ExportPdfController | null>(null);
  const [exportState, setExportState] = useState<ExportPdfState | null>(null);
  const previewButton = useRef<HTMLButtonElement | null>(null);
  const previewFocusPending = useRef(false);
  const [previewState, setPreviewState] =
    useState<PublicationPreviewState | null>(null);
  const [live, setLive] = useState<CapturedSnapshot | null>(null);
  const [showClose, setShowClose] = useState(false);
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
    writableRef,
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
  useEffect(() => {
    if (!previewFocusPending.current || previewState?.enabled) return;
    const button = previewButton.current;
    // Closing during Save can remove the focused panel while the toolbar is
    // disabled. Wait for its next enabled commit, respecting any newer focus.
    if (
      document.activeElement !== document.body &&
      document.activeElement !== button
    ) {
      previewFocusPending.current = false;
    } else if (button && !button.disabled) {
      previewFocusPending.current = false;
      button.focus();
    }
  });
  const [move, setMove] = useState<PreparedMove | null>(null);
  const [moveMessage, setMoveMessage] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const moveAbortRef = useRef<AbortController | null>(null);
  const [outline, setOutline] = useState<ProjectionState>({
    phase: 'pending',
    projection: null,
    message: 'Preparing outline…',
  });
  const [character, setCharacter] = useState<string | null>(null);
  const [characterHighlight, setCharacterHighlight] = useState(false);
  const positions = useMemo(() => localRecentPositions(), []);
  const [positionError, setPositionError] = useState('');
  const positionRemember = useRef<(closing?: boolean) => void>(() => {});
  const positionClosing = useRef(false);
  const positionCloseHint = useRef<RecentPosition | null>(null);
  const retainClosingPosition = () => {
    positionRemember.current();
    positionClosing.current = true;
  };
  const positionRestore = useRef<{
    hint: RecentPosition;
    state: import('prosemirror-state').EditorState;
  } | null>(null);

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
    const view = viewRef.current;
    if (view)
      highlightCharacter(
        view,
        outline.phase === 'current' ? outline.projection : null,
        characterHighlight
          ? (outline.projection?.facts.characters.find(
              (entry) => entry.name === character,
            ) ?? null)
          : null,
      );
  }, [outline, character, characterHighlight]);

  useEffect(() => {
    const pending = positionRestore.current,
      view = viewRef.current;
    if (phase !== 'active' || outline.phase !== 'current' || !pending || !view)
      return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (
          positionRestore.current !== pending ||
          view.isDestroyed ||
          view.state.doc !== pending.state.doc ||
          !view.state.selection.eq(pending.state.selection)
        )
          return;
        positionRestore.current = null;
        restoreRecentViewport(view, pending.hint);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase, outline]);

  useEffect(() => {
    if (!showTitle && titleReturnFocusRef.current) {
      titleReturnFocusRef.current = false;
      titleButtonRef.current?.focus();
    }
  }, [showTitle]);

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
            session: editorOrigin(view.state).session,
            version: editorVersion(view.state),
            doc: view.state.doc,
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
            state.phase === 'current' ? state.projection : null,
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
          if (exportRef.current?.busy) {
            setError('Finish or cancel PDF export before closing the window.');
            return;
          }
          if (titleDraftRef.current || titleComposingRef.current) {
            setError(
              'Apply or Discard the uncommitted title input before closing the window.',
            );
            return;
          }
          windowCloseRef.current = true;
          retainClosingPosition();
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
      typewriter.destroy();
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
    pendingSwitchRef.current = switching;
    retainClosingPosition();
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

  const previewMove = useCallback(
    (request: MoveRequest) => {
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
    },
    [outline.projection, busy],
  );
  const onOutlineNavigate = useCallback(
    (item: OutlineItem) => {
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
    },
    [outline.projection],
  );
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
      projection.doc === current.state.doc &&
      projection.version === editorVersion(current.state) &&
      projection.session === editorOrigin(current.state).session;
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
      readOnly: !writableRef.current,
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
        case 'saveAs':
          void run(() => currentSession.saveAs().then(reportOutcome));
          break;
        case 'exportFountain':
          void run(() => currentSession.exportCopy().then(reportOutcome));
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
          popupRef.current?.controller.dismiss();
          setShowTitle(true);
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
  const paletteNavigation = () =>
    outline.phase === 'current' && outline.projection
      ? outline.projection.index.items.map((item) => {
          const captured = outline.projection!;
          return {
            id: `navigation.${item.id}`,
            label: `${item.kind === 'scene' ? 'Scene ' + item.ordinal : 'Section'}: ${item.label.slice(0, 300)}`,
            hint: item.sceneNumber
              ? `Authored number ${item.sceneNumber}`
              : 'Navigate without editing',
            activate: () => {
              const current = viewRef.current;
              const facts = commandContext();
              if (
                !current ||
                facts.blocked ||
                facts.composing ||
                facts.staged ||
                !facts.ready ||
                !navigateOutline(current, captured, item.row)
              )
                setError(
                  'Palette navigation is stale or unavailable. Text and selection are retained.',
                );
            },
          };
        })
      : [];

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
            onDismiss={() => setExportState(null)}
          />
        )}
      {phase === 'active' && previewState?.enabled && previewRef.current && (
        <PublicationPreview
          controller={previewRef.current}
          state={previewState}
          onClose={() => {
            previewFocusPending.current = true;
            previewRef.current?.close();
          }}
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
          readOnly={() => !writableRef.current}
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
          onNavigate={(entry) => {
            const view = viewRef.current,
              captured = outline.projection;
            const row = view?.state.selection.$head.index(0) ?? -1;
            const next = entry.cues.find((cue) => cue > row) ?? entry.cues[0];
            if (
              !view ||
              !captured ||
              !captured.facts.characters.includes(entry) ||
              next === undefined ||
              !readyRef.current ||
              frozenRef.current ||
              operationRef.current ||
              titleDraftRef.current ||
              titleComposingRef.current ||
              !navigateOutline(view, captured, next)
            )
              setError(
                'Character navigation is unavailable for this version. Text and selection are retained.',
              );
          }}
        />
      )}
      {positionError && <p role="status">{positionError}</p>}
      {phase === 'active' && (
        <Outline
          state={outline}
          disabled={busy || showClose}
          moveDisabled={Boolean(active?.readOnly) || Boolean(move)}
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
          <p role="status">{status || 'Protection status unavailable.'}</p>
          {error && <p role="alert">{error}</p>}
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
      <div className="actions" aria-label="Screenplay actions">
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
          onClick={() => {
            previewRef.current?.accept(outline);
            previewRef.current?.open();
          }}
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
      {hosts}

      {session && session.active && showClose && (
        <ProtectedClosePanel
          close={session.close}
          statusToken={`${active?.liveVersion}:${status}`}
          destination={copyDestination ?? undefined}
          onClosed={() => {
            setShowClose(false);
            positionRemember.current(true);
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
