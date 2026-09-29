import { invoke } from '@tauri-apps/api/core';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { createCompletionPopup } from '../../../src/app/CompletionPopup';
import { localShortcutRegistry } from '../../../src/application/shortcuts';
import { createEditorState } from '../../../src/editor/state';
import { mountScreenplayEditor } from '../../../src/editor/view';
import { EditorCaptureBoundary } from '../../../src/application/editorCapture';
import '../editor-bridge/style.css';
const original =
  '\n@MAYA (V.O.)\nSignal.\n\n@MARY\nHello.\n\n.INT. LAB - NIGHT\n\n@MA (O.S.)\n\n.INT. LA - DAY\n\n.EXT. LAB - NI\n\n.IN\n';
const pointerEvents: {
  kind: string;
  trusted: boolean;
  x: number;
  y: number;
  target: string;
}[] = [];
for (const kind of ['pointerdown', 'mousedown'])
  document.addEventListener(kind, (event) => {
    const mouse = event as MouseEvent;
    pointerEvents.push({
      kind,
      trusted: event.isTrusted,
      x: mouse.clientX,
      y: mouse.clientY,
      target: (event.target as HTMLElement).id,
    });
    if (pointerEvents.length > 10) pointerEvents.shift();
  });
let view: EditorView;
let popup: ReturnType<typeof createCompletionPopup>;
function open() {
  pointerEvents.length = 0;
  popup?.destroy();
  view?.destroy();
  popup = createCompletionPopup(document.body);
  view = mountScreenplayEditor(
    document.querySelector<HTMLElement>('#editor')!,
    createEditorState(new TextEncoder().encode(original)),
    {
      completion: popup.controller,
      shortcuts: localShortcutRegistry('other'),
      refused: (reason) => {
        document.querySelector('#status')!.textContent = reason ?? 'Refused';
      },
      escapeFocus: () => document.getElementById('outside')!.focus(),
    },
  );
  popup.bind(view);
  view.focus();
}
function caret(index: number, offset?: number) {
  const pos =
    1 +
    view.state.doc.content.content
      .slice(0, index)
      .reduce((n, node) => n + node.nodeSize, 0) +
    (offset ?? view.state.doc.child(index).textContent.length);
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
  );
  view.focus();
}
async function report(event: string) {
  const result = await new EditorCaptureBoundary(() => view.state).capture();
  const list = document.querySelector<HTMLElement>('[role=listbox]')!;
  await invoke('record_composition_proof', {
    report: JSON.stringify({
      task: 'M3-07',
      pointerEvents,
      event,
      nativeHost: '__TAURI_INTERNALS__' in window,
      userAgent: navigator.userAgent,
      source: result.snapshot.source,
      sha256: result.snapshot.sourceSha256,
      selection: result.snapshot.capture.selection,
      popup: !list.hidden,
      items: popup.controller.offer?.items,
      selected: popup.controller.selected,
      segment: popup.controller.offer?.segment,
      focus: view.hasFocus(),
      kind: view.state.selection.$from.parent.type.name,
      popupBounds: list.getBoundingClientRect().toJSON(),
      options: [...list.children].map((item) => ({
        id: item.id,
        text: item.textContent,
        bounds: item.getBoundingClientRect().toJSON(),
      })),
    }),
  });
}
document.addEventListener('keydown', (event) => {
  if (!['F1', 'F2', 'F3', 'F7', 'F8', 'F9', 'F10', 'F11'].includes(event.key))
    return;
  event.preventDefault();
  void (async () => {
    if (event.key === 'F1') open();
    if (event.key === 'F7') caret(9, 2);
    if (event.key === 'F9') caret(11, 7);
    if (event.key === 'F10') caret(13);
    if (event.key === 'F11') caret(15);
    if (event.key === 'F2') {
      const item = [...document.querySelectorAll('[role=option]')].find(
        (option) => option.textContent === 'MAYA',
      );
      item?.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    if (event.key === 'F3') {
      view.dom.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      );
      view.dom.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      view.dom.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true }),
      );
      view.dom.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    // Only diagnostics wait; production completion never inserts by timing.
    await new Promise((resolve) => setTimeout(resolve, 80));
    await report(
      event.key === 'F2'
        ? 'synthetic-mouse'
        : event.key === 'F3'
          ? 'synthetic-composition'
          : event.key,
    );
  })().catch((error) => {
    void invoke('record_composition_proof', {
      report: JSON.stringify({
        task: 'M3-07',
        event: 'error',
        error: String(error),
      }),
    });
  });
});
open();
