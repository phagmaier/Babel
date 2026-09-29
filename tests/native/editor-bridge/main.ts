import { invoke } from '@tauri-apps/api/core';
import { TextSelection } from 'prosemirror-state';
import { undo, redo } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { createEditorState, editorVersion } from '../../../src/editor/state';
import { mountScreenplayEditor } from '../../../src/editor/view';
import {
  EditorCaptureBoundary,
  type CaptureResult,
} from '../../../src/application/editorCapture';
import './style.css';

const status = document.querySelector<HTMLElement>('#status')!;
const fixtures = ['lf', 'crlf', 'no-final-newline'];
let fixture = 0;
let view: EditorView;
let boundary: EditorCaptureBoundary;
let held: Promise<CaptureResult> | undefined;
let release: (() => void) | undefined;
const transactionMs: number[] = [];
const events: string[] = [];
function actionPosition(offset = view.state.doc.child(2).textContent.length) {
  return (
    1 +
    view.state.doc.child(0).nodeSize +
    view.state.doc.child(1).nodeSize +
    offset
  );
}
function update() {
  status.textContent = `Native synthetic ${fixtures[fixture]} · live v${editorVersion(view.state)}`;
}
async function report(event: string, result?: CaptureResult) {
  const captured = result ?? (await boundary.capture());
  const snapshot = captured.snapshot;
  await invoke('record_composition_proof', {
    report: JSON.stringify({
      task: 'M3-04',
      event,
      fixture: fixtures[fixture],
      nativeHost: '__TAURI_INTERNALS__' in window,
      userAgent: navigator.userAgent,
      status: captured.status,
      liveVersion: editorVersion(view.state),
      snapshot: {
        version: snapshot.version,
        source: snapshot.source,
        sha256: snapshot.sourceSha256,
        selection: snapshot.capture.selection,
        ranges: snapshot.capture.ranges,
      },
      domSelection: window.getSelection()?.toString(),
      events: events.slice(-20),
      transactionMs: transactionMs.slice(-30),
    }),
  });
}
async function open() {
  view?.destroy();
  // Local synthetic fixture bytes only; production editor modules import no proof code.
  const response = await fetch(
    `/prototypes/editor-composition/fixtures/${fixtures[fixture]}.fountain`,
  );
  if (!response.ok) throw new Error('Synthetic fixture unavailable');
  const source = new Uint8Array(await response.arrayBuffer());
  view = mountScreenplayEditor(
    document.querySelector<HTMLElement>('#editor')!,
    createEditorState(source),
    {
      changed() {
        update();
      },
      refused() {
        status.textContent = 'Refused transformation; live content retained';
      },
    },
  );
  boundary = new EditorCaptureBoundary(() => view.state);
  const dispatch = view.dispatch.bind(view);
  view.dispatch = (transaction) => {
    const start = performance.now();
    dispatch(transaction);
    transactionMs.push(performance.now() - start);
  };
  update();
  view.focus();
  await report('opened');
}
document.addEventListener('beforeinput', (event) =>
  events.push(`beforeinput:${event.inputType}`),
);
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    (event.shiftKey ? redo : undo)(view.state, (tr) => view.dispatch(tr));
    return;
  }
  if (!/^F(?:1|4|5|6|7|8|9|10)$/.test(event.key)) return;
  event.preventDefault();
  void (async () => {
    if (event.key === 'F1') {
      fixture = 0;
      await open();
    }
    if (event.key === 'F4') {
      fixture = (fixture + 1) % fixtures.length;
      await open();
    }
    if (event.key === 'F7') {
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, actionPosition()),
        ),
      );
      view.focus();
      await report('caret-end');
    }
    if (event.key === 'F6') {
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(
            view.state.doc,
            actionPosition(2),
            actionPosition(6),
          ),
        ),
      );
      view.focus();
      await report('selected');
    }
    if (event.key === 'F8') await report('observed');
    if (event.key === 'F9') {
      let pos = 1;
      for (let index = 0; index < 7; index++)
        pos += view.state.doc.child(index).nodeSize;
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, pos + 2, pos + 8),
        ),
      );
      view.focus();
      await report('protected-selected');
    }
    if (event.key === 'F5') {
      if (held) throw new Error('Capture already held');
      const heldBoundary = new EditorCaptureBoundary(() => view.state, {
        defer: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      });
      held = heldBoundary.capture();
      await report('capture-held');
    }
    if (event.key === 'F10') {
      if (!held || !release) throw new Error('No held capture');
      release();
      const captured = await held;
      held = undefined;
      release = undefined;
      await report('released', captured);
    }
  })().catch((error: unknown) => {
    status.textContent = `Inspection failed: ${String(error)}`;
    void invoke('record_composition_proof', {
      report: JSON.stringify({
        task: 'M3-04',
        event: 'error',
        error: String(error),
        liveVersion: editorVersion(view.state),
      }),
    });
  });
});
await open();
