import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { EditorControls } from '../../../src/app/EditorControls';
import { localShortcutRegistry } from '../../../src/application/shortcuts';
import { createEditorState } from '../../../src/editor/state';
import { mountScreenplayEditor } from '../../../src/editor/view';
import { selectionElement } from '../../../src/editor/commands';
import { executeEditorCommand } from '../../../src/editor/shortcuts';
import { EditorCaptureBoundary } from '../../../src/application/editorCapture';
import '../editor-bridge/style.css';
const controls = createRoot(document.querySelector('#controls')!);
const status = document.querySelector<HTMLElement>('#status')!;
const original = '\n@MAYA\n(quietly)\nSignal.\n\n!A bell.\n';
let view: EditorView;
let registry = localShortcutRegistry('other');
let refusal = '';
const events: string[] = [];
for (const kind of ['keydown', 'keyup', 'keypress', 'beforeinput'])
  document.addEventListener(kind, (event) => {
    const key = event as KeyboardEvent;
    const input = event as InputEvent;
    events.push(
      `${kind}:${key.key ?? input.data}:ctrl=${key.ctrlKey}:prevented=${event.defaultPrevented}`,
    );
  });
function refused(reason?: string) {
  refusal = reason ?? 'Transformation refused; content retained';
  status.textContent = refusal;
}
function renderControls() {
  controls.render(
    <EditorControls
      state={view.state}
      registry={registry}
      execute={(id) => {
        executeEditorCommand(view, id, refused);
        view.focus();
        renderControls();
      }}
    />,
  );
}
function open() {
  view?.destroy();
  refusal = '';
  view = mountScreenplayEditor(
    document.querySelector<HTMLElement>('#editor')!,
    createEditorState(new TextEncoder().encode(original)),
    {
      changed: renderControls,
      refused,
      shortcuts: registry,
      escapeFocus: () => document.getElementById('screenplay-element')!.focus(),
    },
  );
  renderControls();
  view.focus();
  status.textContent = 'Synthetic live draft; no source saved';
}
function caret(index: number) {
  const pos =
    1 +
    view.state.doc.content.content
      .slice(0, index)
      .reduce((n, node) => n + node.nodeSize, 0) +
    view.state.doc.child(index).textContent.length;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
  );
  view.focus();
}
async function report(event: string) {
  const result = await new EditorCaptureBoundary(() => view.state).capture();
  await invoke('record_composition_proof', {
    report: JSON.stringify({
      task: 'M3-06',
      events: events.slice(-30),
      event,
      nativeHost: '__TAURI_INTERNALS__' in window,
      userAgent: navigator.userAgent,
      source: result.snapshot.source,
      sha256: result.snapshot.sourceSha256,
      selection: result.snapshot.capture.selection,
      element: selectionElement(view.state),
      focus: document.activeElement?.id || document.activeElement?.tagName,
      picker: (
        document.getElementById('screenplay-element') as HTMLSelectElement
      )?.value,
      actionBinding: registry.binding('element.action'),
      refusal,
      preferenceNotice: document.querySelector(
        '.editor-controls [role="status"]',
      )?.textContent,
    }),
  });
}
document.addEventListener('keydown', (event) => {
  if (!['F1', 'F2', 'F7', 'F8', 'F9', 'F12'].includes(event.key)) return;
  event.preventDefault();
  void (async () => {
    if (event.key === 'F1') open();
    if (event.key === 'F7') caret(5);
    if (event.key === 'F9') caret(2);
    if (event.key === 'F2') {
      document.querySelectorAll('details')[1]!.open = true;
      document
        .querySelector<HTMLInputElement>('.editor-controls input')!
        .focus();
    }
    if (event.key === 'F12') {
      registry = localShortcutRegistry('other');
      open();
    }
    await report('observed');
  })().catch((error) => {
    void invoke('record_composition_proof', {
      report: JSON.stringify({
        task: 'M3-06',
        event: 'error',
        error: String(error),
      }),
    });
  });
});
open();
