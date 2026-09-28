import { invoke } from '@tauri-apps/api/core';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { schema } from 'prosemirror-schema-basic';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { makeFixture } from './fixture';
import './style.css';

const requested = Number(
  new URLSearchParams(location.search).get('pages') ?? '120',
);
const pages =
  ([120, 300, 600] as const).find((size) => size === requested) ?? 120;
const fixture = makeFixture(pages);
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const summary = document.querySelector<HTMLParagraphElement>('#summary')!;
const reportBox = document.querySelector<HTMLTextAreaElement>('#report')!;
const editor = document.querySelector<HTMLElement>('#editor')!;
const counts = {
  keydown: 0,
  beforeinput: 0,
  input: 0,
  compositionstart: 0,
  compositionupdate: 0,
  compositionend: 0,
  paste: 0,
  transactions: 0,
  documentChanges: 0,
};
const keyToFrame: number[] = [];
const transactionMs: number[] = [];
const changeTransactionMs: number[] = [];
const inputTypes: string[] = [];
const events: string[] = [];
let composingEnter = 0;
let lastKey = '';
let lastComposition = '';
let lastPaste = '';
let lastTransactionAt = 0;
let lastCaret: { from: number; to: number } | null = null;

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.ceil(sorted.length * fraction) - 1]!.toFixed(2));
}

function scheduleFrameSample(start: number) {
  requestAnimationFrame(() => {
    keyToFrame.push(performance.now() - start);
    if (keyToFrame.length > 500) keyToFrame.shift();
  });
}

function recordEvent(value: string) {
  events.push(value);
  if (events.length > 40) events.shift();
}

const initialDoc = schema.nodes.doc.create(
  null,
  fixture.paragraphs.map((line) =>
    schema.nodes.paragraph.create(null, schema.text(line)),
  ),
);
const state = EditorState.create({
  doc: initialDoc,
  plugins: [
    history(),
    keymap({ 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo }),
    keymap(baseKeymap),
  ],
});
const view = new EditorView(editor, {
  state,
  dispatchTransaction(transaction) {
    const start = performance.now();
    const next = view.state.apply(transaction);
    view.updateState(next);
    const duration = performance.now() - start;
    transactionMs.push(duration);
    if (transactionMs.length > 500) transactionMs.shift();
    counts.transactions++;
    if (transaction.docChanged) {
      counts.documentChanges++;
      changeTransactionMs.push(duration);
      if (changeTransactionMs.length > 500) changeTransactionMs.shift();
    }
    lastTransactionAt = performance.now();
    lastCaret = { from: next.selection.from, to: next.selection.to };
  },
});

view.dom.addEventListener(
  'keydown',
  (event) => {
    counts.keydown++;
    lastKey = `${event.key}${event.isComposing ? ' (composing)' : ''}`;
    if (event.key === 'Enter' && event.isComposing) composingEnter++;
    recordEvent(`keydown:${event.key}:composing=${event.isComposing}`);
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      scheduleFrameSample(performance.now());
    }
  },
  true,
);
view.dom.addEventListener(
  'beforeinput',
  (event) => {
    counts.beforeinput++;
    const inputEvent = event as InputEvent;
    inputTypes.push(inputEvent.inputType);
    if (inputTypes.length > 20) inputTypes.shift();
    recordEvent(`beforeinput:${inputEvent.inputType}`);
  },
  true,
);
view.dom.addEventListener(
  'input',
  () => {
    counts.input++;
  },
  true,
);
view.dom.addEventListener(
  'compositionstart',
  () => {
    counts.compositionstart++;
    recordEvent('compositionstart');
  },
  true,
);
view.dom.addEventListener(
  'compositionupdate',
  (event) => {
    counts.compositionupdate++;
    lastComposition = (event as CompositionEvent).data;
    recordEvent(`compositionupdate:${lastComposition}`);
  },
  true,
);
view.dom.addEventListener(
  'compositionend',
  (event) => {
    counts.compositionend++;
    lastComposition = (event as CompositionEvent).data;
    recordEvent(`compositionend:${lastComposition}`);
  },
  true,
);
view.dom.addEventListener(
  'paste',
  (event) => {
    counts.paste++;
    lastPaste = event.clipboardData?.getData('text/plain')?.slice(0, 120) ?? '';
    recordEvent(`paste:${lastPaste}`);
  },
  true,
);

async function hashFixture() {
  const bytes = new TextEncoder().encode(fixture.text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function report() {
  const selection = view.state.selection;
  const domSelection = window.getSelection();
  const data = {
    nativeHost: '__TAURI_INTERNALS__' in window,
    userAgent: navigator.userAgent,
    fixture: {
      pages,
      blocks: fixture.blocks,
      lines: fixture.lines,
      bytes: new TextEncoder().encode(fixture.text).length,
      sha256: await hashFixture(),
    },
    counts,
    composingEnter,
    lastKey,
    lastComposition,
    lastPaste,
    inputTypes,
    events,
    selection: {
      from: selection.from,
      to: selection.to,
      empty: selection.empty,
    },
    domSelection: {
      anchorOffset: domSelection?.anchorOffset,
      focusOffset: domSelection?.focusOffset,
      text: domSelection?.toString().slice(0, 120),
    },
    docSize: view.state.doc.content.size,
    docTail: view.state.doc.textBetween(
      Math.max(0, view.state.doc.content.size - 180),
      view.state.doc.content.size,
      '\n',
    ),
    keyToFrameMs: {
      count: keyToFrame.length,
      p50: percentile(keyToFrame, 0.5),
      p95: percentile(keyToFrame, 0.95),
      max: keyToFrame.length ? Math.max(...keyToFrame) : null,
    },
    transactionMs: {
      count: transactionMs.length,
      p50: percentile(transactionMs, 0.5),
      p95: percentile(transactionMs, 0.95),
      max: transactionMs.length ? Math.max(...transactionMs) : null,
    },
    changeTransactionMs: {
      count: changeTransactionMs.length,
      p50: percentile(changeTransactionMs, 0.5),
      p95: percentile(changeTransactionMs, 0.95),
      max: changeTransactionMs.length ? Math.max(...changeTransactionMs) : null,
    },
    lastTransactionAt,
    lastCaret,
  };
  const serialized = JSON.stringify(data);
  reportBox.value = JSON.stringify(data, null, 2);
  reportBox.focus();
  reportBox.select();
  if ('__TAURI_INTERNALS__' in window) {
    try {
      await invoke('record_native_editor_proof', { report: serialized });
      status.textContent = 'Report sent to native proof log.';
    } catch (error) {
      status.textContent = `Native proof report failed: ${String(error)}`;
    }
  } else {
    status.textContent = 'Browser report ready.';
  }
}

function focusEnd() {
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.atEnd(view.state.doc))
      .scrollIntoView(),
  );
  view.focus();
}
document
  .querySelector<HTMLButtonElement>('#focus-end')!
  .addEventListener('click', focusEnd);
document
  .querySelector<HTMLButtonElement>('#copy-report')!
  .addEventListener('click', () => {
    void report();
  });
document.addEventListener('keydown', (event) => {
  if (event.key === 'F7') {
    event.preventDefault();
    focusEnd();
  }
  if (event.key === 'F8') {
    event.preventDefault();
    void report();
  }
  if (event.key === 'F10') {
    event.preventDefault();
    const next = pages === 120 ? 300 : pages === 300 ? 600 : 120;
    location.search = `?pages=${next}`;
  }
});

summary.textContent = `${pages} page-equivalent workload · ${fixture.blocks} blocks · ${fixture.lines} source lines`;
status.textContent = `READY · ${'__TAURI_INTERNALS__' in window ? 'native Tauri/WebKit' : 'browser only'}`;
view.dispatch(
  view.state.tr
    .setSelection(TextSelection.atEnd(view.state.doc))
    .scrollIntoView(),
);
view.focus();
