import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { undo, undoDepth } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  buildManuscriptIndex,
  type ManuscriptIndex,
} from '../../src/domain/manuscriptIndex';
import {
  defaultFindOptions,
  findSlices,
  type FindOptions,
} from '../../src/domain/find';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  editForMatch,
  planReplace,
  prepareEditorReplace,
  replaceAllTransaction,
  replaceOneTransaction,
  REPLACE_ALL_CONFIRM_THRESHOLD,
} from '../../src/editor/replace';

const bytes = (text: string) => new TextEncoder().encode(text);
const hash = async (source: Uint8Array) =>
  createHash('sha256').update(source).digest('hex');

async function project(source: string): Promise<{
  state: EditorState;
  projection: ManuscriptProjection;
  index: ManuscriptIndex;
}> {
  const state = createEditorState(bytes(source));
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
    hash,
  });
  const snapshot = (await boundary.capture()).snapshot;
  const index = buildManuscriptIndex(snapshot.capture.document);
  const rows: { id: string; from: number }[] = [];
  state.doc.forEach((node, position) =>
    rows.push({ id: String(node.attrs.id), from: position + 1 }),
  );
  const projection = {
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
    index,
    snapshot,
    rows,
    sourceSha256: 'test',
  } as ManuscriptProjection;
  return { state, projection, index };
}

const search = (
  index: ManuscriptIndex,
  query: string,
  options: Partial<FindOptions> = {},
  row = -1,
) =>
  [
    ...findSlices(index, { ...defaultFindOptions, query, ...options }, row),
  ].flat();

const opts = (query: string, options: Partial<FindOptions> = {}) => ({
  ...defaultFindOptions,
  query,
  ...options,
});

function apply(state: EditorState, tr: EditorState['tr']): EditorState {
  const result = state.applyTransaction(tr);
  expect(result.transactions.length).toBeGreaterThan(0);
  return result.state;
}

function dispatch(state: EditorState, tr: EditorState['tr']): EditorState {
  let next = apply(state, tr);
  const sealed = next.applyTransaction(next.tr.setMeta('addToHistory', false));
  next = sealed.state;
  return next;
}

it('plans body edits and refuses protected scopes with explicit reasons', async () => {
  const { projection, index } = await project(
    'Title: moon\n\n!moon shines.\n[[moon]]\n/*moon*/\n',
  );
  const matches = search(index, 'moon');
  expect(matches.map((match) => match.location.scope)).toEqual([
    'title',
    'body',
    'note',
    'omitted',
  ]);
  const plan = planReplace(projection, matches, opts('moon'), 'sun');
  expect(plan.query).toBe('moon');
  expect(plan.replacement).toBe('sun');
  // Body and the safe single-line note are editable; title and boneyard refuse.
  expect(plan.edits.map((edit) => edit.match.location.scope)).toEqual([
    'body',
    'note',
  ]);
  expect(plan.edits[0]!.expected).toBe('moon');
  expect(plan.refused.map((refusal) => refusal.reason)).toEqual([
    'Title matches stay read-only here. Use the Title page form; source retained.',
    'A protected omission keeps its exact bytes; source retained.',
  ]);
  expect(plan.large).toBe(false);
  expect(editForMatch(plan, matches[1]!)).toBe(0);
  expect(editForMatch(plan, matches[0]!)).toBe(-1);
});

it('validates replacement bounds before planning', async () => {
  const { projection, index } = await project('!moon\n');
  const matches = search(index, 'moon');
  expect(() =>
    planReplace(projection, matches, opts('moon'), 'a'.repeat(1025)),
  ).toThrow('Replacement exceeds');
  expect(() => planReplace(projection, matches, opts('moon'), 'a\nb')).toThrow(
    'line breaks',
  );
  expect(() => planReplace(projection, matches, opts('moon'), 'a\rb')).toThrow(
    'line breaks',
  );
  expect(() =>
    planReplace(projection, matches, opts('moon'), 'a\ud83db'),
  ).toThrow('incomplete Unicode');
  for (const delimiter of ['[[', ']]', '/*', '*/'])
    expect(() =>
      planReplace(projection, matches, opts('moon'), `a${delimiter}b`),
    ).toThrow('hidden-region delimiters');
});

it('replace-all is atomic: exact bytes, preserved marks and one-step Undo', async () => {
  const source = '!The moon **shines** over the moon.\n\n!moon\n';
  const { state: initial, projection, index } = await project(source);
  const plan = planReplace(
    projection,
    search(index, 'moon'),
    opts('moon'),
    'sun',
  );
  expect(plan.edits).toHaveLength(3);
  const transaction = prepareEditorReplace(initial, projection, plan, {
    all: true,
  });
  const selection = initial.selection;
  const state = dispatch(initial, transaction);
  expect(Array.from(captureEditor(state).source)).toEqual(
    Array.from(bytes('!The sun **shines** over the sun.\n\n!sun\n')),
  );
  expect(undoDepth(state)).toBeGreaterThan(0);
  const undone: EditorState[] = [];
  expect(
    undo(state, (tr) => {
      const result = state.applyTransaction(tr);
      undone.push(result.state);
    }),
  ).toBe(true);
  expect(undone).toHaveLength(1);
  expect(Array.from(captureEditor(undone[0]!).source)).toEqual(
    Array.from(bytes(source)),
  );
  expect(undone[0]!.selection.eq(selection)).toBe(true);
});

it('replace-one restores the caret at the replacement and refreshes matches', async () => {
  const {
    state: initial,
    projection,
    index,
  } = await project('!moon and moon\n');
  const plan = planReplace(
    projection,
    search(index, 'moon'),
    opts('moon'),
    'sun',
  );
  expect(plan.edits).toHaveLength(2);
  const transaction = prepareEditorReplace(initial, projection, plan, {
    one: 0,
  });
  const state = dispatch(initial, transaction);
  expect(state.doc.textContent).toBe('sun and moon');
  expect(state.selection.empty).toBe(true);
  expect(state.selection.from).toBe('sun'.length + 1);
  const refreshed = await project('!sun and moon\n');
  const next = planReplace(
    refreshed.projection,
    search(refreshed.index, 'moon'),
    opts('moon'),
    'sun',
  );
  expect(next.edits).toHaveLength(1);
  expect(next.edits[0]!.expected).toBe('moon');
});

it('rejects stale plans and foreign matches without changing the editor', async () => {
  const first = await project('!moon\n');
  const plan = planReplace(
    first.projection,
    search(first.index, 'moon'),
    opts('moon'),
    'sun',
  );
  const edited = apply(first.state, first.state.tr.insertText('X', 1));
  expect(() =>
    prepareEditorReplace(edited, first.projection, plan, { one: 0 }),
  ).toThrow('stale');
  expect(edited.doc.textContent).toBe('Xmoon');
  const second = await project('!moon\n');
  const foreign = planReplace(
    second.projection,
    search(first.index, 'moon'),
    opts('moon'),
    'sun',
  );
  expect(foreign.edits).toHaveLength(0);
  expect(foreign.refused[0]!.reason).toContain('foreign');
  expect(() =>
    replaceOneTransaction(second.state, second.projection, foreign, 0),
  ).toThrow('not replaceable');
  expect(() =>
    replaceAllTransaction(second.state, second.projection, foreign),
  ).toThrow('no replaceable match');
});

it('empty replacement deletes the match and round-trips exact bytes', async () => {
  const source = '!Old moon shines.\n';
  const { state: initial, projection, index } = await project(source);
  const plan = planReplace(
    projection,
    search(index, 'moon '),
    opts('moon'),
    '',
  );
  expect(plan.edits).toHaveLength(1);
  const state = dispatch(
    initial,
    prepareEditorReplace(initial, projection, plan, { all: true }),
  );
  expect(Array.from(captureEditor(state).source)).toEqual(
    Array.from(bytes('!Old shines.\n')),
  );
});

it('respects case, whole-word and scene scope through the plan', async () => {
  const source =
    'Title: moon\n\n.INT. ONE - DAY\n!moonlight moon\n!MOON\n.INT. TWO - DAY\n!moon\n';
  const { projection, index } = await project(source);
  const whole = planReplace(
    projection,
    search(index, 'moon', { wholeWord: true }),
    opts('moon', { wholeWord: true }),
    'sun',
  );
  expect(whole.edits.map((edit) => edit.expected)).toEqual([
    'moon',
    'MOON',
    'moon',
  ]);
  const sensitive = planReplace(
    projection,
    search(index, 'moon', { caseSensitive: true }),
    opts('moon', { caseSensitive: true }),
    'sun',
  );
  expect(sensitive.edits).toHaveLength(3);
  const sceneMatches = search(index, 'moon', { scope: 'scene' }, 6);
  expect(sceneMatches.map((match) => match.location.row)).toEqual([6]);
  const scene = planReplace(
    projection,
    sceneMatches,
    opts('moon', { scope: 'scene' }),
    'sun',
  );
  expect(scene.edits).toHaveLength(1);
  expect(scene.edits[0]!.row).toBe(6);
});

it('preserves dialogue groups and marks across replace-all with exact reopen', async () => {
  const source = '@ALICE\nThe moon *rises*.\n\n@BOB\nmoon\n';
  const { state: initial, projection, index } = await project(source);
  const plan = planReplace(
    projection,
    search(index, 'moon'),
    opts('moon'),
    'sun',
  );
  expect(plan.edits).toHaveLength(2);
  const state = dispatch(
    initial,
    prepareEditorReplace(initial, projection, plan, { all: true }),
  );
  const produced = captureEditor(state).source;
  expect(Array.from(produced)).toEqual(
    Array.from(bytes('@ALICE\nThe sun *rises*.\n\n@BOB\nsun\n')),
  );
  const speech = state.doc.child(1);
  expect(speech.attrs.speechOf).toBe(state.doc.child(0).attrs.id);
  const reopened = parseFountain(produced);
  expect(Array.from(serializeFountain(reopened))).toEqual(Array.from(produced));
});

it('marks large replace-all plans for confirmation at the documented threshold', async () => {
  const below = '!moon\n'.repeat(REPLACE_ALL_CONFIRM_THRESHOLD - 1);
  const at = '!moon\n'.repeat(REPLACE_ALL_CONFIRM_THRESHOLD);
  for (const [source, large] of [
    [below, false],
    [at, true],
  ] as const) {
    const { projection, index } = await project(source);
    const plan = planReplace(
      projection,
      search(index, 'moon'),
      opts('moon'),
      'sun',
    );
    expect(plan.edits).toHaveLength(source.split('\n').length - 1);
    expect(plan.large).toBe(large);
  }
});

it('replaces inside safe literal notes while keeping delimiters byte-exact', async () => {
  const source = '[[moon]]\n\n!moon\n';
  const { state: initial, projection, index } = await project(source);
  const matches = search(index, 'moon');
  const plan = planReplace(projection, matches, opts('moon'), 'sun');
  const noteEdit = plan.edits.find(
    (edit) => edit.match.location.scope === 'note',
  );
  expect(noteEdit?.expected).toBe('moon');
  const state = dispatch(
    initial,
    prepareEditorReplace(initial, projection, plan, { all: true }),
  );
  expect(Array.from(captureEditor(state).source)).toEqual(
    Array.from(bytes('[[sun]]\n\n!sun\n')),
  );
});
