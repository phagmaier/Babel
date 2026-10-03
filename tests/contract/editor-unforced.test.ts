/** AUDIT-C01/T-01: structural and blank-row edits next to unforced Fountain syntax stay capturable. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';
import { smartKeyTransaction, type SmartKey } from '../../src/editor/commands';
import { captureEditor } from '../../src/editor/sourceBridge';

const UNFORCED =
  'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n';
const bytes = (source: string) => new TextEncoder().encode(source);
const text = (source: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(source);
function pos(state: EditorState, index: number, offset = 0) {
  let result = 1 + offset;
  for (let i = 0; i < index; i++) result += state.doc.child(i).nodeSize;
  return result;
}
function caret(state: EditorState, index: number, offset = 0) {
  return applyEditorTransaction(
    state,
    state.tr.setSelection(
      TextSelection.create(state.doc, pos(state, index, offset)),
    ),
  ).state;
}
const end = (state: EditorState, index: number) =>
  caret(state, index, state.doc.child(index).textContent.length);
/** Undefined when the command refuses; refusal must leave the state untouched. */
function key(state: EditorState, name: SmartKey): EditorState | undefined {
  const result = smartKeyTransaction(state, name);
  if (!result.transaction) return undefined;
  const applied = applyEditorTransaction(state, result.transaction);
  return applied.accepted ? applied.state : undefined;
}
function press(state: EditorState, name: SmartKey): EditorState {
  const next = key(state, name);
  expect(next, `${name} refused`).toBeDefined();
  return next!;
}
function type(state: EditorState, typed: string): EditorState {
  for (const character of typed) {
    const applied = applyEditorTransaction(
      state,
      state.tr.insertText(character),
    );
    expect(applied.accepted).toBe(true);
    state = applied.state;
  }
  return state;
}
const rows = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
/** Capture must succeed and the saved bytes must reopen as the rows on screen. */
function saved(state: EditorState): string {
  const source = captureEditor(state).source;
  expect(rows(createEditorState(source))).toEqual(rows(state));
  return text(source);
}

describe('AUDIT-C01 edits on an unforced standard Fountain source', () => {
  const open = () => createEditorState(bytes(UNFORCED));

  it('case 1: Enter at the end of a scene heading, then typing', () => {
    const state = type(press(end(open(), 0), 'Enter'), 'Dark.');
    expect(saved(state)).toBe(
      '.INT. HOUSE - DAY\n!Dark.\n\nJohn walks in.\n\nJOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('case 2: one letter on the blank row under a heading', () => {
    expect(saved(type(caret(open(), 1), 'x'))).toBe(
      '.INT. HOUSE - DAY\n!x\nJohn walks in.\n\nJOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('case 3: one letter on the blank row above a character cue', () => {
    expect(saved(type(caret(open(), 3), 'x'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n!x\n@JOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('case 4: Enter at the start of a dialogue line refuses without mutation', () => {
    const state = caret(open(), 5);
    const result = smartKeyTransaction(state, 'Enter');
    expect(result.handled).toBe(true);
    expect(result.transaction).toBeUndefined();
    expect(result.reason).toMatch(/speaker/i);
    expect(saved(state)).toBe(UNFORCED);
  });

  it('case 5: Backspace removes the blank row under a heading', () => {
    for (const state of [
      press(caret(open(), 1), 'Backspace'),
      press(caret(open(), 2), 'Backspace'),
    ])
      expect(saved(state)).toBe(
        '.INT. HOUSE - DAY\nJohn walks in.\n\nJOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
      );
  });

  it('case 6: Enter after an unforced transition, then typing', () => {
    expect(saved(type(press(end(open(), 7), 'Enter'), 'x'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n\n>CUT TO:\n!x\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('case 7: Enter in the middle of a heading leaves a heading and an Action row', () => {
    const state = press(caret(open(), 0, 4), 'Enter');
    expect(rows(state).slice(0, 2)).toEqual([
      'sceneHeading:INT.',
      'action: HOUSE - DAY',
    ]);
    expect(saved(state)).toBe(
      '.INT.\n! HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('deleting the blank row before a cue, transition or heading forces only that row', () => {
    expect(saved(press(caret(open(), 3), 'Backspace'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n@JOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
    expect(saved(press(end(open(), 2), 'Delete'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n@JOHN\nHello there.\n\nCUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
    expect(saved(press(caret(open(), 6), 'Backspace'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n>CUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
    expect(saved(press(caret(open(), 8), 'Backspace'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n\n>CUT TO:\n.EXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('typing on the blank row between a transition and a heading forces both neighbours', () => {
    expect(saved(type(caret(open(), 8), 'x'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n\n>CUT TO:\n!x\n.EXT. PARK - NIGHT\n\nThey sit.\n',
    );
    expect(saved(type(caret(open(), 6), 'x'))).toBe(
      'INT. HOUSE - DAY\n\nJohn walks in.\n\nJOHN\nHello there.\n!x\n>CUT TO:\n\nEXT. PARK - NIGHT\n\nThey sit.\n',
    );
  });

  it('a forced re-spelling keeps indentation, scene number, BOM and CRLF bytes', () => {
    const original =
      '﻿  INT. HOUSE - DAY #12A#\r\n\r\nJohn walks in.\r\n\r\n\tJOHN (V.O.)\r\nHello.\r\n';
    let state = createEditorState(bytes(original));
    state = type(caret(state, 1), 'x');
    state = press(caret(state, 3), 'Backspace');
    expect(saved(state)).toBe(
      '﻿  .INT. HOUSE - DAY #12A#\r\n!x\r\nJohn walks in.\r\n\t@JOHN (V.O.)\r\nHello.\r\n',
    );
  });

  it('reverting the edit restores the exact unforced bytes', () => {
    let state = type(caret(open(), 1), 'x');
    expect(saved(state)).not.toBe(UNFORCED);
    state = applyEditorTransaction(
      state,
      state.tr.delete(state.selection.from - 1, state.selection.from),
    ).state;
    expect(saved(state)).toBe(UNFORCED);
  });
});

describe('AUDIT-C01/T-01 property: blank rows and row boundaries on idiomatic sources', () => {
  const directory = 'fixtures/fountain';
  const sources: [string, Uint8Array][] = [
    ['audit scene', bytes(UNFORCED)],
    ...readdirSync(directory)
      .filter((name) => name.endsWith('.fountain'))
      .sort()
      .map((name): [string, Uint8Array] => [
        name,
        new Uint8Array(readFileSync(`${directory}/${name}`)),
      ]),
  ];
  const operations: [
    string,
    (s: EditorState, i: number) => EditorState | undefined,
  ][] = [
    ['Backspace at row start', (s, i) => key(caret(s, i), 'Backspace')],
    ['Delete at row end', (s, i) => key(end(s, i), 'Delete')],
    ['Enter at row start', (s, i) => key(caret(s, i), 'Enter')],
    [
      'Enter at row end then a letter',
      (s, i) => {
        const next = key(end(s, i), 'Enter');
        return next && typed(next);
      },
    ],
    [
      'a letter on a blank row',
      (s, i) => (s.doc.child(i).textContent ? undefined : typed(caret(s, i))),
    ],
  ];
  /**
   * Shapes AUDIT-C01 leaves uncapturable, recorded in docs/test-evidence/AUDIT.md:
   * Enter between the rows of one speech (Dialogue has no forcing marker; the
   * Enter table belongs to AUDIT-D01), edits that regroup dual dialogue (needs
   * explicit group intent), and rows next to protected source.
   */
  function remaining(state: EditorState, index: number, label: string) {
    const row = (at: number) =>
      at >= 0 && at < state.doc.childCount ? state.doc.child(at) : undefined;
    const group = (at: number) =>
      row(at)?.type.name === 'character'
        ? row(at)!.attrs.id
        : row(at)?.attrs.speechOf;
    if (
      label.startsWith('Enter at row end') &&
      group(index) &&
      group(index) === group(index + 1)
    )
      return true;
    let cue = index + 1;
    while (row(cue) && !row(cue)!.textContent) cue++;
    if (row(cue)?.attrs.dualWith) return true;
    return [index - 1, index, index + 1, index + 2].some(
      (at) => row(at)?.attrs.protected,
    );
  }
  /** Typing may be refused by the transaction guard (protected rows). */
  function typed(state: EditorState): EditorState | undefined {
    const applied = applyEditorTransaction(state, state.tr.insertText('x'));
    return applied.accepted ? applied.state : undefined;
  }

  for (const [name, source] of sources)
    it(`${name}: every accepted edit captures and reopens as shown`, () => {
      let initial: EditorState;
      try {
        initial = createEditorState(source);
      } catch {
        return; // Undecodable fixtures have no editor state to edit.
      }
      const failures: string[] = [];
      let accepted = 0;
      for (let index = 0; index < initial.doc.childCount; index++)
        for (const [label, operation] of operations) {
          let next: EditorState | undefined;
          try {
            next = operation(initial, index);
          } catch {
            continue; // Caret cannot be placed in this row.
          }
          if (!next || next.doc.eq(initial.doc)) continue;
          if (remaining(initial, index, label)) continue;
          accepted++;
          try {
            const captured = captureEditor(next).source;
            const reopened = rows(createEditorState(captured));
            if (JSON.stringify(reopened) !== JSON.stringify(rows(next)))
              failures.push(`${label} @${index}: reopens differently`);
          } catch (error) {
            failures.push(`${label} @${index}: ${(error as Error).message}`);
          }
        }
      expect(failures).toEqual([]);
      if (name === 'audit scene') expect(accepted).toBeGreaterThan(40);
    });
});
