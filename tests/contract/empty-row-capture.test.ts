import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { createCompletionPopup } from '../../src/app/CompletionPopup';
import {
  elementChoices,
  ShortcutRegistry,
} from '../../src/application/shortcuts';
import { executeEditorCommand } from '../../src/editor/shortcuts';
import { captureEditor } from '../../src/editor/sourceBridge';
import { createEditorState } from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';

// AUDIT-PARK-H. Pinned as found, not as wanted. In a screenplay opened from
// source, an empty Scene Heading cannot capture until it has text. F1 fixes
// the new Note/Omitted material cases previously pinned as uncapturable. What the
// application does meanwhile is pinned in tests/ui/WritingView.test.tsx and
// tests/native/writing-lifecycle/empty_heading.py.
let view: EditorView;
let popup: ReturnType<typeof createCompletionPopup>;

function mount(source: string) {
  const host = document.createElement('div');
  document.body.append(host);
  popup = createCompletionPopup(document.body);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(source)),
    {
      completion: popup.controller,
      shortcuts: new ShortcutRegistry('other'),
      escapeFocus: () => host.focus(),
      refused: () => undefined,
    },
  );
  vi.spyOn(view, 'coordsAtPos').mockReturnValue({
    left: 40,
    right: 40,
    top: 20,
    bottom: 40,
  });
  popup.bind(view);
  view.focus();
}
const source = () => new TextDecoder().decode(captureEditor(view.state).source);
const lastRow = () => {
  const node = view.state.doc.lastChild!;
  return `${node.type.name}:${node.textContent}`;
};
/** Caret to the end of the document, Enter, then the Element picker's choice. */
function newRow(id: string) {
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, view.state.doc.content.size - 1),
    ),
  );
  view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  vi.runOnlyPendingTimers();
  expect(executeEditorCommand(view, `element.${id}`)).toBe(true);
  vi.runOnlyPendingTimers();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  popup.destroy();
  view.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
});

const uncapturable: Record<string, RegExp> = {
  sceneHeading: /cannot round-trip unambiguously/,
};

describe('AUDIT-PARK-H empty rows the editor cannot capture (pinned as found)', () => {
  it.each(elementChoices.map(([id]) => id))(
    'a new empty %s row after text',
    (id) => {
      mount('!Alpha.\n');
      newRow(id);
      const refusal = uncapturable[id];
      if (refusal) expect(() => captureEditor(view.state)).toThrow(refusal);
      // Every other choice captures, and keeps the text typed before it.
      else expect(source().startsWith('!Alpha.\n\n')).toBe(true);
    },
  );

  it('one character makes the empty Scene Heading row capturable again', () => {
    mount('!Alpha.\n');
    newRow('sceneHeading');
    view.dispatch(view.state.tr.insertText('X'));
    vi.runOnlyPendingTimers();
    expect(lastRow()).toBe('sceneHeading:X');
    expect(source()).toBe('!Alpha.\n\n.X\n');
  });

  it.each([
    ['note', 'note:[[X]]', '[[X]]'],
    ['boneyard', 'boneyard:/*X*/', '/*X*/'],
  ])(
    'AUDIT-PARK-H-F1 a new %s row captures with text, as do fresh documents and existing rows',
    (id, row, spelling) => {
      mount('!Alpha.\n');
      newRow(id);
      view.dispatch(view.state.tr.insertText('X'));
      vi.runOnlyPendingTimers();
      expect(lastRow()).toBe(row);
      expect(source()).toBe(`!Alpha.\n\n${spelling}\n`);
      popup.destroy();
      view.destroy();
      document.body.replaceChildren();
      // The same keys in a document typed from zero bytes capture.
      mount('');
      view.dispatch(view.state.tr.insertText('Alpha.'));
      newRow(id);
      view.dispatch(view.state.tr.insertText('X'));
      vi.runOnlyPendingTimers();
      expect(source()).toBe(`!Alpha.\n\n${spelling}\n`);
      popup.destroy();
      view.destroy();
      document.body.replaceChildren();
      // So does converting a row the opened source already holds.
      mount('!Alpha.\n\n\n');
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, view.state.doc.content.size - 1),
        ),
      );
      expect(executeEditorCommand(view, `element.${id}`)).toBe(true);
      view.dispatch(view.state.tr.insertText('X'));
      vi.runOnlyPendingTimers();
      expect(source()).toBe(`!Alpha.\n\n${spelling}\n`);
    },
  );

  it('every choice on an empty document captures', () => {
    for (const [id] of elementChoices) {
      mount('');
      expect(executeEditorCommand(view, `element.${id}`)).toBe(true);
      vi.runOnlyPendingTimers();
      if (!['note', 'boneyard', 'pageBreak'].includes(id))
        expect(source()).toBe('');
      else expect(() => captureEditor(view.state)).not.toThrow();
      popup.destroy();
      view.destroy();
      document.body.replaceChildren();
    }
    mount('');
  });
});
