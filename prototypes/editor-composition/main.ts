import { invoke } from '@tauri-apps/api/core';
import { baseKeymap } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  PersistenceController,
  type CapturedSnapshot,
} from '../../src/application/persistenceController';
import type { OpenDocument } from '../../src/application/documents';
import { nativeDocuments } from '../../src/infrastructure/nativeDocuments';
import { apply, createState, currentVersion, snapshot } from './model';
import './style.css';

const status = document.querySelector<HTMLElement>('#status')!;
const receiptBox = document.querySelector<HTMLElement>('#receipt')!;
const select = document.querySelector<HTMLSelectElement>('#fixture')!;
const requested = new URLSearchParams(location.search).get('fixture');
if (requested && ['lf', 'crlf', 'no-final-newline'].includes(requested))
  select.value = requested;
let view: EditorView | undefined;
let opened: OpenDocument | undefined;
let controller: PersistenceController | undefined;
let captureTail: Promise<void> = Promise.resolve();
let busy = false;
let opening = false;
let activeFixture = '';
const events: string[] = [];
const transactionMs: number[] = [];
const keyToFrameMs: number[] = [];

async function hash(source: Uint8Array) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(source).buffer,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
function describe(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}
function updateStatus() {
  const state = controller?.state;
  status.textContent = state
    ? `NATIVE · ${activeFixture} · live v${view ? currentVersion(view.state) : state.liveVersion} · file v${state.fileSavedVersion ?? 'none'} · recovery v${state.journaledVersion ?? 'none'}${state.externalChange ? ' · EXTERNAL CHANGE — source replacement refused' : ''}`
    : 'Native fixture not open';
}
/** Hash/source derivation and persistence are queued outside dispatch/key handlers. */
function capture(state: EditorState): Promise<CapturedSnapshot> {
  const owner = controller!;
  const result = captureTail.then(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const captured = snapshot(state);
    const value: CapturedSnapshot = {
      version: captured.version,
      source: Array.from(captured.source),
      sourceSha256: await hash(captured.source),
      draftMetadata: {
        schemaVersion: 1,
        selection: {
          anchor: { ...captured.selection.anchor },
          head: { ...captured.selection.head },
        },
      },
    };
    if (owner !== controller) throw new Error('Old proof session');
    if (value.version > owner.state.liveVersion) owner.changed(value);
    else if (
      value.version !== owner.state.liveVersion ||
      value.sourceSha256 !== owner.state.liveSha256 ||
      value.source.length !== owner.state.liveByteLength
    )
      throw new Error(
        'Capture is stale or disagrees with its immutable version',
      );
    updateStatus();
    return value;
  });
  captureTail = result.then(
    () => undefined,
    (error) => {
      status.textContent = `Capture refused: ${describe(error)}`;
    },
  );
  return result;
}
async function report(event: string, detail: unknown = null) {
  const state = view?.state;
  const captured = state ? snapshot(state) : undefined;
  const dom = window.getSelection();
  const data = {
    event,
    detail,
    nativeHost: '__TAURI_INTERNALS__' in window,
    userAgent: navigator.userAgent,
    fixture: activeFixture,
    identity: opened?.identity,
    snapshot: captured
      ? {
          ...captured,
          source: Array.from(captured.source),
          sha256: await hash(captured.source),
        }
      : null,
    persistence: controller?.state,
    domSelection: {
      text: dom?.toString(),
      anchorOffset: dom?.anchorOffset,
      focusOffset: dom?.focusOffset,
    },
    events: events.slice(-80),
    transactionMs: transactionMs.slice(-80),
    keyToFrameMs: keyToFrameMs.slice(-80),
  };
  await invoke('record_composition_proof', { report: JSON.stringify(data) });
}
function actionPosition(offset?: number) {
  if (!view) throw new Error('Open a fixture first');
  let pos = 1;
  for (let i = 0; i < 2; i++) pos += view.state.doc.child(i).nodeSize;
  return pos + (offset ?? view.state.doc.child(2).textContent.length);
}
async function open(reopening = false) {
  opening = true;
  view?.setProps({ editable: () => false });
  try {
    await openFixture(reopening);
  } finally {
    opening = false;
    view?.setProps({ editable: () => Boolean(controller) });
    if (controller) view?.focus();
  }
}
async function openFixture(reopening: boolean) {
  if (opened) {
    await captureTail;
    if (
      !controller ||
      !view ||
      controller.state.fileSavedVersion !== currentVersion(view.state)
    )
      throw new Error(
        'Save the exact live version before releasing this proof registration',
      );
    await nativeDocuments.release(opened.identity);
    controller = undefined;
    opened = undefined;
  }
  const fixture = reopening ? activeFixture : select.value;
  opened = await invoke<OpenDocument>('open_composition_fixture', { fixture });
  if (opened.ownership.status !== 'exclusive' || opened.encoding !== 'utf8')
    throw new Error('Proof needs exclusive UTF-8 ownership');
  activeFixture = fixture;
  let state = createState(Uint8Array.from(opened.source));
  state = state.reconfigure({
    plugins: [
      ...state.plugins,
      keymap({ 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo }),
      keymap(baseKeymap),
    ],
  });
  controller = new PersistenceController(opened, nativeDocuments);
  view?.destroy();
  view = new EditorView(document.querySelector<HTMLElement>('#editor')!, {
    state,
    editable: () => !opening,
    dispatchTransaction(transaction) {
      if (opening) {
        view!.updateState(view!.state);
        return;
      }
      const start = performance.now();
      const result = apply(view!.state, transaction);
      if (!result.accepted) {
        view!.updateState(view!.state);
        status.textContent =
          'Transformation refused; source and history retained';
        return;
      }
      view!.updateState(result.state);
      updateStatus();
      transactionMs.push(performance.now() - start);
      if (transaction.docChanged || transaction.selectionSet)
        void capture(result.state).catch(() => undefined);
    },
    handlePaste(_view, event) {
      const text = event.clipboardData?.getData('text/plain');
      if (text === undefined || /[\r\n]/.test(text)) {
        status.textContent =
          'Multiline/non-text paste refused; source retained';
        return true;
      }
      view!.dispatch(view!.state.tr.insertText(text));
      return true;
    },
  });
  for (const type of [
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'compositionend',
  ]) {
    view.dom.addEventListener(
      type,
      (event) => {
        events.push(
          `${type}:${event instanceof KeyboardEvent ? event.key : event instanceof InputEvent ? event.inputType : ''}`,
        );
        if (events.length > 160) events.shift();
        if (type === 'keydown') {
          const start = performance.now();
          requestAnimationFrame(() =>
            keyToFrameMs.push(performance.now() - start),
          );
        }
      },
      true,
    );
  }
  await capture(state);
  await report(reopening ? 'reopened' : 'opened', {
    nativeSource: opened.source,
    fingerprint: opened.fingerprint,
  });
  view.focus();
  updateStatus();
}
async function save() {
  if (!view || !controller) throw new Error('Open a native fixture first');
  const value = await capture(view.state);
  try {
    const checkpoint = await controller.checkpoint(value);
    const receipt = await controller.save(value);
    receiptBox.textContent = JSON.stringify({ checkpoint, receipt }, null, 2);
    updateStatus();
    await report('saved', receipt);
  } catch (error) {
    receiptBox.textContent = `No source success: ${describe(error)}`;
    updateStatus();
    await report('save-refused', error);
    throw error;
  }
}
async function run(work: () => Promise<void>) {
  if (busy) return;
  busy = true;
  try {
    await work();
  } catch (error) {
    status.textContent = `Refused/failed: ${describe(error)}`;
  } finally {
    busy = false;
  }
}
document.querySelector('#open')!.addEventListener('click', () => {
  void run(() => open());
});
document.querySelector('#save')!.addEventListener('click', () => {
  void run(save);
});
document.querySelector('#reopen')!.addEventListener('click', () => {
  void run(() => open(true));
});
document.querySelector('#report')!.addEventListener('click', () => {
  void run(() => report('observed'));
});
document.addEventListener('keydown', (event) => {
  const commands: Record<string, () => Promise<void>> = {
    F1: () => open(),
    F2: save,
    F3: () => open(true),
    F8: () => report('observed'),
  };
  if (commands[event.key]) {
    event.preventDefault();
    void run(commands[event.key]!);
  }
  if (event.key === 'F4' && !opened) {
    event.preventDefault();
    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
  }
  if (view && (event.key === 'F7' || event.key === 'F6')) {
    event.preventDefault();
    const from = actionPosition(event.key === 'F6' ? 2 : undefined);
    const to = event.key === 'F6' ? actionPosition(6) : from;
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, from, to))
        .scrollIntoView(),
    );
    view.focus();
  }
});
status.textContent =
  '__TAURI_INTERNALS__' in window
    ? 'Native host ready · F1 opens a synthetic fixture'
    : 'Native proof unavailable in a browser';
