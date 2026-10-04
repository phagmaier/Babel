import { invoke } from '@tauri-apps/api/core';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { OpenDocument } from '../../../src/application/documents';
import {
  FountainImportBoundary,
  type ImportResult,
} from '../../../src/application/fountainImport';
import { WritingSession } from '../../../src/application/writingSession';
import { nativeDocuments } from '../../../src/infrastructure/nativeDocuments';
import { nativeDocumentEntry } from '../../../src/infrastructure/nativeDocumentEntry';
import { nativeSnapshots } from '../../../src/infrastructure/nativeSnapshots';
import { nativeSaveAs } from '../../../src/infrastructure/nativeSaveAs';
import { nativeWorkflowProtection } from '../../../src/infrastructure/nativeWorkflowProtection';
import { workflowView } from '../../workflowView';
import { createFountainImportPanel } from '../../../src/app/FountainImportPanel';
import { createEditorState, editorVersion } from '../../../src/editor/state';
import { mountScreenplayEditor } from '../../../src/editor/view';
import { localShortcutRegistry } from '../../../src/application/shortcuts';
import { EditorCaptureBoundary } from '../../../src/application/editorCapture';
import '../editor-bridge/style.css';
const encoder = new TextEncoder();
const original = '\n@MAYA\nHello world.\n';
let view!: EditorView;
let rows = 3;
let transactionMs: number[] = [];
let keyRafMs: number[] = [];
let inputEvents: {
  kind: string;
  key?: string;
  keyCode?: number;
  code?: string;
  ctrl?: boolean;
  trusted: boolean;
  types?: string[];
}[] = [];
let composition: { kind: string; data: string | null; trusted: boolean }[] = [];
let imported: ImportResult | undefined;
let pending: Promise<void> | undefined;
const opened: OpenDocument | null =
  '__TAURI_INTERNALS__' in window
    ? await invoke('open_composition_fixture', { fixture: 'lf' })
    : null;
let panel: ReturnType<typeof createFountainImportPanel> | undefined;
function importBoundary() {
  return new FountainImportBoundary(
    () => view,
    async (apply, signal) => {
      if (!opened)
        return { status: 'refused', reason: 'Native fixture unavailable' };
      // This fixture retains one native registration across resets. Each import
      // owns/disposes its cadence; default-app drills own native close/release.
      const session = new WritingSession(
        {
          entry: nativeDocumentEntry,
          documents: nativeDocuments,
          saveAs: nativeSaveAs,
          snapshots: nativeSnapshots,
          workflows: nativeWorkflowProtection,
        },
        workflowView(() => view),
      );
      try {
        await session.openSelected(async () => opened);
        return await session.runProtectedWorkflow(
          'fountainImport',
          apply,
          signal,
        );
      } finally {
        session.dispose();
      }
    },
  );
}
function open(text = original) {
  view?.destroy();
  panel?.destroy();
  transactionMs = [];
  keyRafMs = [];
  composition = [];
  inputEvents = [];
  imported = undefined;
  rows = text.split('\n').length - 1;
  view = mountScreenplayEditor(
    document.querySelector<HTMLElement>('#editor')!,
    createEditorState(encoder.encode(text)),
    {
      shortcuts: localShortcutRegistry('other'),
      transactionMeasured: (ms, changed) => {
        if (changed) transactionMs.push(ms);
      },
      refused: (reason) => {
        document.querySelector('#status')!.textContent = reason ?? 'Refused';
      },
    },
  );
  view.dom.addEventListener(
    'keydown',
    (event) => {
      inputEvents.push({
        kind: 'keydown',
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        ctrl: event.ctrlKey,
        trusted: event.isTrusted,
      });
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        const start = performance.now();
        requestAnimationFrame(() => keyRafMs.push(performance.now() - start));
      }
    },
    true,
  );
  for (const kind of ['paste', 'copy', 'cut'])
    view.dom.addEventListener(
      kind,
      (event) => {
        inputEvents.push({
          kind,
          trusted: event.isTrusted,
          types: [...((event as ClipboardEvent).clipboardData?.types ?? [])],
        });
      },
      true,
    );
  for (const kind of [
    'compositionstart',
    'compositionupdate',
    'compositionend',
  ])
    view.dom.addEventListener(kind, (event) => {
      const e = event as CompositionEvent;
      composition.push({ kind, data: e.data, trusted: e.isTrusted });
    });
  if (opened)
    panel = createFountainImportPanel(
      document.querySelector<HTMLElement>('#import')!,
      importBoundary(),
    );
  caret(rows - 1);
  view.focus();
}
function pos(row: number, offset = 0) {
  return (
    1 +
    view.state.doc.content.content
      .slice(0, row)
      .reduce((sum, n) => sum + n.nodeSize, 0) +
    offset
  );
}
function caret(
  row: number,
  offset = view.state.doc.child(row).content.size,
  end = offset,
  endRow = row,
) {
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, pos(row, offset), pos(endRow, end)),
    ),
  );
  view.focus();
}
function large(count: number) {
  open(
    Array.from(
      { length: count },
      (_, index) =>
        `!Synthetic row ${index}: A quiet signal crosses the room beside Zoë and her notebook.\n`,
    ).join(''),
  );
}
function mixed(count: number) {
  const cycle = [
    '!Action beside Zoë and her notebook.',
    '',
    '@MAYA',
    'A quiet signal.',
    '(softly)',
    'Hello שלום é.',
    '',
    '/*',
    'Synthetic omitted note.',
    '*/',
    '!Action resumes.',
  ];
  // Use complete cycles; no unclosed region is silently repaired.
  const source =
    Array.from(
      { length: Math.floor((count - 1) / cycle.length) },
      (_, index) =>
        cycle
          .map((line, at) =>
            at === 0 && index % 50 === 0
              ? '!' + 'Long synthetic paragraph. '.repeat(320)
              : line,
          )
          .join('\n') + '\n',
    ).join('') + '!Final action.\n';
  open(source);
}
async function report(event: string) {
  await pending;
  const result = await new EditorCaptureBoundary(() => view.state).capture();
  const capture = result.snapshot.capture;
  const report = {
    task: 'M3-08',
    event,
    nativeHost: '__TAURI_INTERNALS__' in window,
    userAgent: navigator.userAgent,
    rows,
    source: rows < 100 ? [...capture.source] : undefined,
    sha256: result.snapshot.sourceSha256,
    byteLength: capture.source.length,
    selection: capture.selection,
    kind: view.state.selection.$from.parent.type.name,
    marks: view.state.selection.$from.parent.content.content.flatMap((n) =>
      n.marks.map((m) => m.type.name),
    ),
    rowTexts:
      rows < 100
        ? view.state.doc.content.content.map((n) => n.textContent)
        : undefined,
    version: editorVersion(view.state),
    composition,
    inputEvents: inputEvents.slice(-140),
    unsafeDom: !!view.dom.querySelector(
      'img,iframe,svg,link,style,script,[onclick],[onerror]',
    ),
    transactionMs,
    keyRafMs,
    imported,
    status: document.querySelector('#status')!.textContent,
    tail: rows >= 100 ? view.state.doc.lastChild!.textContent : undefined,
  };
  if ('__TAURI_INTERNALS__' in window)
    await invoke('record_composition_proof', {
      report: JSON.stringify(report),
    });
  else (window as unknown as { inputReport: unknown }).inputReport = report;
}
document.addEventListener('keydown', (event) => {
  if (
    !['F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8', 'F9', 'F10', 'F11'].includes(
      event.key,
    )
  )
    return;
  event.preventDefault();
  try {
    if (event.key === 'F1') open();
    if (event.key === 'F2') caret(2, 6, 11);
    if (event.key === 'F3') caret(2, 0, view.state.doc.child(2).content.size);
    if (event.key === 'F5')
      caret(1, 0, view.state.doc.child(2).content.size, 2);
    if (event.key === 'F7') {
      open('!target\n');
      caret(0, 0, 6);
    }
    if (event.key === 'F9') {
      if (event.shiftKey) mixed(2400);
      else large(2400);
    }
    if (event.key === 'F10') {
      if (event.shiftKey) mixed(6000);
      else large(6000);
    }
    if (event.key === 'F11') {
      if (event.shiftKey) mixed(12000);
      else large(12000);
    }
    if (event.key === 'F4') {
      if (!opened) throw new Error('Native import host unavailable');
      const boundary = importBoundary();
      pending = boundary
        .import(
          encoder.encode(
            '\ufeffTitle: Imported\r\n\r\n!New screenplay\r\n/* retained unknown */\r\n',
          ),
        )
        .then((result) => {
          imported = result;
        });
    }
    if (event.key === 'F8')
      void report(event.key).catch((error) => {
        console.error(error);
        void invoke('record_composition_proof', {
          report: JSON.stringify({
            task: 'M3-08',
            event: 'error',
            error: String(error),
          }),
        });
      });
  } catch (error) {
    console.error(error);
    void invoke('record_composition_proof', {
      report: JSON.stringify({
        task: 'M3-08',
        event: 'error',
        error: String(error),
      }),
    });
  }
});
open();
// Browser security inspection sees the same production paste path without any native privileges.
(window as unknown as { inputView: EditorView }).inputView = view;
