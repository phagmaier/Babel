import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redoDepth, undoDepth } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { createCompletionPopup } from '../../src/app/CompletionPopup';
import { ShortcutRegistry } from '../../src/application/shortcuts';
import {
  assessmentLayoutProbes,
  describeOmissions,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';
import {
  evaluateScriptCheck,
  requiresExportReview,
} from '../../src/domain/scriptCheck';
import { executeEditorCommand } from '../../src/editor/shortcuts';
import { captureEditor } from '../../src/editor/sourceBridge';
import { createEditorState } from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';

// AUDIT-D07. The same hand-written fixture is rendered by the pinned helper in
// tools/pdf-helper/test_helper.py and checked against the renderer's own
// paragraph classification and pdftotext.
const fixture = JSON.parse(
  readFileSync('fixtures/assessment/typed-scene.json', 'utf8'),
) as {
  source: string;
  rows: string[];
  omissions: Record<
    'notes' | 'boneyards' | 'sections' | 'synopses',
    [number, number]
  >;
};

let view: EditorView;
let popup: ReturnType<typeof createCompletionPopup>;
let refusals: string[];
/** Rows whose Enter was consumed by an open suggestion (S07.6). */
let consumed: string[];

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  popup = createCompletionPopup(document.body);
  refusals = [];
  consumed = [];
  view = mountScreenplayEditor(host, createEditorState(new Uint8Array()), {
    completion: popup.controller,
    shortcuts: new ShortcutRegistry('other'),
    escapeFocus: () => host.focus(),
    refused: (reason) => refusals.push(reason ?? 'refused'),
  });
  vi.spyOn(view, 'coordsAtPos').mockReturnValue({
    left: 40,
    right: 40,
    top: 20,
    bottom: 40,
  });
  popup.bind(view);
  view.focus();
}
const row = () => view.state.selection.$head.parent;
const text = () => new TextDecoder().decode(captureEditor(view.state).source);
/** One keydown through the mounted view's DOM handler, as WebKit delivers it. */
function press(key: string, init: KeyboardEventInit = {}) {
  view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
  vi.runOnlyPendingTimers();
}
function enter() {
  if (popup.controller.offer) consumed.push(row().textContent);
  press('Enter');
}
/** Typed characters; the completion timer runs as it would between keys. */
function type(value: string) {
  view.dispatch(view.state.tr.insertText(value));
  vi.runOnlyPendingTimers();
}
/** The element picker and command palette use this route for unbound choices. */
function choose(id: string) {
  expect(
    executeEditorCommand(view, id, (reason) =>
      refusals.push(reason ?? 'refused'),
    ),
  ).toBe(true);
  vi.runOnlyPendingTimers();
}
/** The End key; the browser moves the caret natively, which JSDOM lacks. */
function end() {
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, view.state.selection.$head.end()),
    ),
  );
}
function report() {
  const capture = captureEditor(view.state);
  return evaluateScriptCheck(capture.document, {
    identity,
    version: capture.version,
    sourceSha256: 'a'.repeat(64),
    layout: assessmentLayoutProbes(capture.document).map(() => null),
  });
}
const rows = () =>
  view.state.doc.content.content.map(
    (node) =>
      `${node.type.name === 'action' && node.attrs.actionSubtype === 'shot' ? 'shot' : node.type.name}:${node.textContent}`,
  );

beforeEach(() => {
  vi.useFakeTimers();
  mount();
});
afterEach(() => {
  popup.destroy();
  view.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('AUDIT-D07 typed-scene oracle (mounted editor, JSDOM)', () => {
  it('types every S07.2 row from an empty document into the shared fixture bytes', () => {
    press('1', { ctrlKey: true });
    type('INT. KITCHEN - DAY');
    // The identical DAY suggestion is no acceptance: one Enter ends the
    // heading (S07.6, PILOT-2026-10-06).
    enter();
    type('Maya enters.');
    enter();
    press('Tab');
    type('MAYA');
    enter();
    press('Tab');
    type('(quietly)');
    enter();
    type('Hello there.');
    enter();
    press('Tab');
    type('JON');
    enter();
    type('Hi.');
    choose('dialogue.dual');
    enter();
    press('6', { ctrlKey: true });
    type('CUT TO:');
    enter();
    press('Tab');
    // Finding D07-F4: the empty cue opens names; a second Tab would accept one.
    expect(popup.controller.offer?.items).toEqual(['JON', 'MAYA']);
    press('Escape');
    press('Tab');
    type('EXT. GARDEN - NIGHT');
    // The identical NIGHT suggestion is no acceptance: one Enter ends the
    // heading (S07.6, PILOT-2026-10-06).
    enter();
    press('7', { ctrlKey: true });
    type('CLOSE ON the gate.');
    enter();
    press('8', { ctrlKey: true });
    type('Row, row, row your boat');
    enter();
    type('Gently down the stream');
    enter();
    enter(); // empty Lyrics exits to Action
    type('They sing.');
    enter();
    choose('element.centered');
    type('INTERMISSION');
    enter();
    choose('element.section');
    type('Act Two');
    enter();
    choose('element.synopsis');
    type('Maya decides.');
    enter();
    choose('element.pageBreak');
    end(); // finding D07-F3: the choice leaves the caret before ===
    enter();
    type('The end.');
    enter();
    choose('element.note');
    type('check the gate');
    enter(); // inside a note Enter inserts a note line
    type('and the lock');

    expect(refusals).toEqual([]);
    expect(consumed).toEqual(['INT. KITCHEN - DAY', 'EXT. GARDEN - NIGHT']);
    expect(text()).toBe(fixture.source);
    expect(rows()).toEqual(fixture.rows);
    const node = (index: number) => view.state.doc.child(index);
    for (const [line, cue] of [
      [5, 4],
      [6, 4],
      [9, 8],
    ] as const)
      expect(node(line).attrs.speechOf, `row ${line}`).toBe(node(cue).attrs.id);
    expect(node(8).attrs.dualWith).toBe(node(4).attrs.id);

    // Reopening the captured bytes gives the same rows and relationships.
    const capture = captureEditor(view.state);
    const reopened = createEditorState(
      capture.source,
      capture.document.recovery,
    );
    const meaning = (doc: typeof view.state.doc) =>
      doc.content.content.map((n) => [
        n.type.name,
        n.textContent,
        n.attrs.actionSubtype,
        n.attrs.speechOf,
        n.attrs.dualWith,
      ]);
    expect(meaning(reopened.doc)).toEqual(meaning(view.state.doc));

    const checked = report();
    expect(checked.issues).toEqual([]);
    expect(checked.truncated).toBe(false);
    expect(requiresExportReview(checked)).toBe(false);
    const assessment = checked.exportAssessment;
    if (assessment.status !== 'verified') throw new Error('unavailable');
    expect(assessment.issues).toEqual([]);
    expect(assessment.layout).toBe('verified');
    const omissions = assessment.omissions;
    expect({
      notes: [omissions.notes.count, omissions.notes.lines],
      boneyards: [omissions.boneyards.count, omissions.boneyards.lines],
      sections: [omissions.sections.count, omissions.sections.lines],
      synopses: [omissions.synopses.count, omissions.synopses.lines],
    }).toEqual(fixture.omissions);
    expect(describeOmissions(omissions)).toBe(
      'Not printed by this profile: 1 note (2 lines), 1 section heading, 1 synopsis.',
    );

    // Ctrl+Z walks the whole scene back to zero bytes; Ctrl+Shift+Z replays it.
    for (let guard = 0; undoDepth(view.state) > 0 && guard < 500; guard++)
      press('z', { ctrlKey: true });
    expect(undoDepth(view.state)).toBe(0);
    expect(text()).toBe('');
    for (let guard = 0; redoDepth(view.state) > 0 && guard < 500; guard++)
      press('z', { ctrlKey: true, shiftKey: true });
    expect(text()).toBe(fixture.source);
  });
});

describe('AUDIT-D07 findings, pinned as found (tracked in TODO; a fix updates these)', () => {
  it('D07-F1: Enter on an empty Dialogue after a cue starts Action without a separator; Script Check gates it', () => {
    press('3', { ctrlKey: true });
    type('MAYA');
    enter();
    enter();
    type('She leaves.');
    expect(text()).toBe('@MAYA\n!She leaves.\n');
    const checked = report();
    // The pinned renderer prints "!She leaves." as MAYA's dialogue.
    expect(
      checked.issues.map((issue) => [issue.code, issue.severity, issue.line]),
    ).toEqual([
      ['SC001', 'warning', 0],
      ['SC005', 'blocking', 0],
      ['SC005', 'blocking', 1],
    ]);
    expect(requiresExportReview(checked)).toBe(true);
  });

  it('D07-F2: a note at the end of the document has no keyboard exit', () => {
    choose('element.note');
    type('remember');
    end();
    const before = view.state.doc;
    enter();
    press('2', { ctrlKey: true });
    press('Tab');
    expect(refusals).toEqual([
      'Note split needs two nonempty, safely delimited note lines',
      'A note needs an explicit whole-region conversion',
      'A note needs an explicit whole-region conversion',
    ]);
    expect(view.state.doc).toBe(before);
    expect(text()).toBe('[[remember]]\n');
  });

  it('D07-F4: on an empty cue the second Tab of the element cycle accepts a name instead of reaching Scene Heading', () => {
    press('3', { ctrlKey: true });
    type('MAYA');
    enter();
    type('Hi.');
    enter();
    press('Tab'); // Action -> Character opens every known name
    expect(popup.controller.offer?.items).toEqual(['MAYA']);
    press('Tab'); // S07.4 would reach Scene Heading; S07.6 accepts
    expect(rows().at(-1)).toBe('character:MAYA');
    expect(text()).toBe('@MAYA\nHi.\n\n@MAYA\n');
    expect(
      report().issues.map((issue) => [issue.code, issue.severity, issue.line]),
    ).toEqual([
      ['SC001', 'warning', 3],
      ['SC005', 'blocking', 3],
    ]);
  });

  it('D07-F3: the Page Break choice leaves the caret before === so Enter and typing land above it', () => {
    choose('element.pageBreak');
    expect(view.state.selection.$head.parentOffset).toBe(0);
    enter();
    type('x');
    expect(text()).toBe('!x\n===\n');
    const checked = report();
    // The pinned renderer prints "===" as text in the same Action paragraph.
    expect(
      checked.issues.map((issue) => [issue.code, issue.severity, issue.line]),
    ).toEqual([['SC005', 'blocking', 1]]);
  });
});
