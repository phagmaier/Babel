import { describe, expect, it } from 'vitest';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  convertEditorSelection,
  cycleEditorElement,
  type EditorCommandResult,
} from '../../src/editor/commands';
import { toggleEditorMark } from '../../src/editor/formatting';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-01: a command refuses with a reason instead of leaving a
// draft that capture refuses. Typed text and every captured byte stay as they were.
const open = (source: string) =>
  createEditorState(new TextEncoder().encode(source));
function at(state: EditorState, row: number, offset: number) {
  let position = 1;
  for (let index = 0; index < row; index++)
    position += state.doc.child(index).nodeSize;
  return (
    position +
    (offset < 0 ? state.doc.child(row).content.size + offset + 1 : offset)
  );
}
/** Caret or selection; a negative offset counts back from the row's end. */
function select(
  state: EditorState,
  row: number,
  offset: number,
  toOffset?: number,
  toRow = row,
) {
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        at(state, row, offset),
        toOffset === undefined ? undefined : at(state, toRow, toOffset),
      ),
    ),
  );
}
const saved = (state: EditorState) =>
  new TextDecoder().decode(captureEditor(state).source);
function applied(state: EditorState, result: EditorCommandResult) {
  expect(result.transaction, result.reason).toBeDefined();
  const next = applyEditorTransaction(state, result.transaction!);
  expect(next.accepted).toBe(true);
  return next.state;
}
/** The command changed nothing, gave a reason, and the draft still saves. */
function refusedWith(
  state: EditorState,
  result: EditorCommandResult,
  reason: string,
) {
  expect([result.handled, result.transaction, result.reason]).toEqual([
    true,
    undefined,
    reason,
  ]);
  expect(() => captureEditor(state)).not.toThrow();
}
function typed(state: EditorState, text: string) {
  const next = applyEditorTransaction(state, state.tr.insertText(text));
  expect(next.accepted).toBe(true);
  return next.state;
}

const emphasis =
  'Selected emphasis cannot round-trip in Fountain; selection retained';
const storedEmphasis =
  'Emphasis cannot start at the beginning of this element in Fountain';
const continuation =
  'Convert the rest of the speech together; Fountain ends dialogue at another element';
const speaker =
  'Convert the speech continuation together before introducing a new speaker';
const unheld = (label: string) =>
  `This text cannot be saved as ${label} in Fountain; the row is unchanged`;

const forced = '!Alpha.\n\n.HALL\n\n!Omega.\n';
const natural = 'Alpha.\n\nINT. HOUSE - DAY\n\nOmega.\n';
const numbered = '!Alpha.\n\n.HALL #12#\n\n!Omega.\n';
const speech = '@BOB\nOne.\nTwo.\nThree.\n';

describe('AUDIT-PARK-H-F4-01 formatting', () => {
  it('refuses emphasis that would start a Scene Heading', () => {
    for (const source of [forced, natural, numbered])
      for (const style of ['bold', 'italic', 'underline']) {
        const whole = select(open(source), 2, 0, -1);
        refusedWith(whole, toggleEditorMark(whole, style), emphasis);
        const first = select(open(source), 2, 0, 1);
        refusedWith(first, toggleEditorMark(first, style), emphasis);
      }
    // A selection that reaches the heading from another row is one command.
    const across = select(open(forced), 0, 2, 2, 4);
    refusedWith(across, toggleEditorMark(across, 'bold'), emphasis);
  });

  it('still formats a Scene Heading after its first character', () => {
    const tail = select(open(forced), 2, 2, -1);
    expect(saved(applied(tail, toggleEditorMark(tail, 'italic')))).toBe(
      '!Alpha.\n\n.HA*LL*\n\n!Omega.\n',
    );
  });

  it('refuses a stored mark at the start of a Scene Heading, empty or not', () => {
    for (const source of [forced, natural]) {
      const start = select(open(source), 2, 0);
      refusedWith(start, toggleEditorMark(start, 'bold'), storedEmphasis);
    }
    const emptied = select(open(forced), 2, 0, -1);
    const empty = applyEditorTransaction(
      emptied,
      emptied.tr.deleteSelection(),
    ).state;
    refusedWith(empty, toggleEditorMark(empty, 'underline'), storedEmphasis);
    const inside = select(open(forced), 2, 2);
    const marked = applied(inside, toggleEditorMark(inside, 'bold'));
    expect(saved(typed(marked, 'X'))).toBe(
      '!Alpha.\n\n.HA**X**LL\n\n!Omega.\n',
    );
  });

  it('leaves formatting of every other element as it was', () => {
    const cases: [string, number, string][] = [
      [
        'Alpha.\n\nMiddle.\n\nOmega.\n',
        2,
        'Alpha.\n\n!**Middle.**\n\nOmega.\n',
      ],
      [
        'Alpha.\n\n@BOB\nHi.\n\nOmega.\n',
        2,
        'Alpha.\n\n@**BOB**\nHi.\n\nOmega.\n',
      ],
      [
        'Alpha.\n\n@BOB\nHi.\n\nOmega.\n',
        3,
        'Alpha.\n\n@BOB\n**Hi.**\n\nOmega.\n',
      ],
      ['Alpha.\n\n>FADE\n\nOmega.\n', 2, 'Alpha.\n\n>**FADE**\n\nOmega.\n'],
      ['Alpha.\n\n# Act\n\nOmega.\n', 2, 'Alpha.\n\n# **Act**\n\nOmega.\n'],
    ];
    for (const [source, row, expected] of cases) {
      const whole = select(open(source), row, 0, -1);
      expect(saved(applied(whole, toggleEditorMark(whole, 'bold')))).toBe(
        expected,
      );
      const start = select(open(source), row, 0);
      const marked = applied(start, toggleEditorMark(start, 'bold'));
      expect(() => captureEditor(typed(marked, 'X'))).not.toThrow();
    }
    const wrapped = select(open('@BOB\n(beat)\nHi.\n'), 1, 0, -1);
    refusedWith(wrapped, toggleEditorMark(wrapped, 'bold'), emphasis);
  });
});

describe('AUDIT-PARK-H-F4-01 conversion', () => {
  it('refuses a speech row leaving its speech while rows of it follow', () => {
    for (const kind of [
      'action',
      'shot',
      'sceneHeading',
      'transition',
      'lyrics',
      'centered',
      'section',
      'synopsis',
      'note',
      'boneyard',
    ])
      for (const row of [1, 2]) {
        const state = select(open(speech), row, 0);
        refusedWith(state, convertEditorSelection(state, kind), continuation);
      }
    const wrapped = select(open('@BOB\n(beat)\nOne.\nTwo.\n'), 1, 0);
    refusedWith(
      wrapped,
      convertEditorSelection(wrapped, 'action'),
      continuation,
    );
    // Two of three rows selected still strands the third.
    const partial = select(open(speech), 1, 0, -1, 2);
    refusedWith(
      partial,
      convertEditorSelection(partial, 'lyrics'),
      continuation,
    );
    // A new speaker keeps its own wording.
    const cue = select(open(speech), 1, 0);
    refusedWith(cue, convertEditorSelection(cue, 'character'), speaker);
  });

  it('converts the last row, or the whole rest of a speech, as before', () => {
    const last = select(open(speech), 3, 0);
    expect(saved(applied(last, convertEditorSelection(last, 'action')))).toBe(
      '@BOB\nOne.\nTwo.\n!Three.\n',
    );
    const rest = select(open(speech), 2, 0, -1, 3);
    expect(saved(applied(rest, convertEditorSelection(rest, 'lyrics')))).toBe(
      '@BOB\nOne.\n~Two.\n~Three.\n',
    );
    const body = select(open(speech), 1, 0, -1, 3);
    expect(saved(applied(body, convertEditorSelection(body, 'action')))).toBe(
      '@BOB\n!One.\n!Two.\n!Three.\n',
    );
    // An empty row below is a recoverable draft, not stranded text.
    const emptied = select(open('@BOB\nOne.\nTwo.\n'), 2, 0, -1);
    const above = select(
      applyEditorTransaction(emptied, emptied.tr.deleteSelection()).state,
      1,
      0,
    );
    expect(saved(applied(above, convertEditorSelection(above, 'action')))).toBe(
      '@BOB\n!One.\n\n',
    );
    // Staying inside the speech is not leaving it.
    const aside = select(typed(select(open(speech), 2, 0, -1), '(aside'), 2, 0);
    expect(
      saved(applied(aside, convertEditorSelection(aside, 'parenthetical'))),
    ).toBe('@BOB\nOne.\n(aside\nThree.\n');
  });

  it('refuses an element that cannot hold the row text', () => {
    const cases: [string, string, string][] = [
      ['x #1#', 'sceneHeading', 'Scene Heading'],
      ['(x)', 'sceneHeading', 'Scene Heading'],
      ["'TIL DAWN", 'sceneHeading', 'Scene Heading'],
      ['.x', 'sceneHeading', 'Scene Heading'],
      ['BOB ^', 'character', 'Character'],
      ['x<', 'transition', 'Transition'],
    ];
    for (const [text, kind, label] of cases) {
      const state = select(open(`Alpha.\n\n!${text}\n\nOmega.\n`), 2, 0);
      expect(state.doc.child(2).textContent).toBe(text);
      refusedWith(state, convertEditorSelection(state, kind), unheld(label));
    }
    // Dialogue has no forcing marker of its own to protect a leading one.
    const marker = select(open('@BOB\nOne.\n!.x\n'), 2, 0);
    expect(marker.doc.child(2).type.name).toBe('action');
    refusedWith(
      marker,
      convertEditorSelection(marker, 'dialogue'),
      unheld('Dialogue'),
    );
  });

  it('converts text the element can hold, and empty rows, as before', () => {
    const heading = select(open('Alpha.\n\n!INT. X\n\nOmega.\n'), 2, 0);
    expect(
      saved(applied(heading, convertEditorSelection(heading, 'sceneHeading'))),
    ).toBe('Alpha.\n\n.INT. X\n\nOmega.\n');
    const blank = select(open('!Alpha.\n\n\n'), 2, 0);
    const empty = applied(blank, convertEditorSelection(blank, 'sceneHeading'));
    expect(saved(typed(empty, 'HALL'))).toBe('!Alpha.\n\n.HALL\n');
  });

  it('stops the Tab cycle with the same reason; Shift+Tab still returns', () => {
    const action = select(open('Alpha.\n\n!(x) y\n\nOmega.\n'), 2, 0);
    const cue = applied(action, cycleEditorElement(action, false));
    expect(cue.doc.child(2).type.name).toBe('character');
    refusedWith(cue, cycleEditorElement(cue, false), unheld('Scene Heading'));
    const back = applied(cue, cycleEditorElement(cue, true));
    expect(saved(back)).toBe('Alpha.\n\n!(x) y\n\nOmega.\n');
  });

  it('lets a row with no spelling be converted to one that has it', () => {
    const stuck = typed(select(open(forced), 2, 0, -1), '(x)');
    expect(() => captureEditor(stuck)).toThrow();
    expect(saved(applied(stuck, convertEditorSelection(stuck, 'action')))).toBe(
      '!Alpha.\n\n!(x)\n\n!Omega.\n',
    );
  });
});
