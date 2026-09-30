import { expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  evaluateScriptCheck,
  MAX_CHECK_ISSUES,
} from '../../src/domain/scriptCheck';
import {
  ScriptCheckController,
  visibleIssues,
} from '../../src/application/scriptCheck';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';

const bytes = (text: string) => new TextEncoder().encode(text);
const check = (source: string) =>
  evaluateScriptCheck(parseFountain(bytes(source)));
const codes = (source: string) =>
  check(source).issues.map((issue) => issue.code);

it('passes clean dialogue and flags a cue without dialogue plus its parenthetical', () => {
  expect(codes('@ALICE\nHello.\n')).toEqual([]);
  expect(codes('@ALICE\n(Hello?)\n')).toEqual(['SC001', 'SC002']);
  expect(codes('@ALICE\n')).toEqual(['SC001']);
  expect(codes('@\n')).toEqual([]);
  expect(codes('\n\n')).toEqual([]);
  const report = check('@ALICE\n(Hello?)\n');
  expect(report.truncated).toBe(false);
  expect(report.issues[0]).toMatchObject({
    code: 'SC001',
    severity: 'warning',
    line: 0,
    endLine: 0,
    hasFix: false,
  });
  expect(report.issues[1]).toMatchObject({
    code: 'SC002',
    severity: 'warning',
    line: 1,
    endLine: 1,
    hasFix: false,
  });
  expect(report.issues[0]!.key).not.toBe(report.issues[1]!.key);
  expect(report.exportAssessment.status).toBe('unavailable');
});

it('maps broken dual relationships to SC003 without touching source', () => {
  const chained = '\n@Mara\nFirst.\n\n@Ivo ^\nReply.\n\n@Zoë ^\nLast.\n';
  const before = Array.from(parseFountain(bytes(chained)).bytes);
  const report = check(chained);
  expect(report.issues.map((issue) => issue.code)).toContain('SC003');
  expect(
    report.issues.every(
      (issue) => issue.severity === 'warning' && issue.hasFix === false,
    ),
  ).toBe(true);
  expect(Array.from(parseFountain(bytes(chained)).bytes)).toEqual(before);
  expect(Array.from(serializeFountain(parseFountain(bytes(chained))))).toEqual(
    before,
  );
});

it('groups raw and unclosed constructs into SC004 review findings', () => {
  expect(codes('\n{{raw}}\n\n!Body.\n')).toContain('SC004');
  expect(codes('[[unclosed tail\n')).toContain('SC004');
  expect(codes('!Clean body.\n')).toEqual([]);
});

function harness(source: string) {
  const state = createEditorState(new TextEncoder().encode(source));
  const stamp = () => ({
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
  });
  const projection = {
    ...stamp(),
    snapshot: { capture: captureEditor(state) },
    rows: [],
    sourceSha256: 'test',
  } as unknown as ManuscriptProjection;
  const controller = new ScriptCheckController(stamp, vi.fn());
  controller.setProjection({ phase: 'current', projection, message: '' });
  return { state, controller, projection };
}

it('runs on demand, filters severities and dismisses only advisories', () => {
  const f = harness('@ALICE\n(Hello?)\n.INT. A - DAY #1#\n.INT. B - DAY #1#\n');
  expect(f.controller.state.phase).toBe('pending');
  f.controller.run();
  expect(f.controller.state.phase).toBe('current');
  expect(f.controller.state.report!.issues.map((issue) => issue.code)).toEqual([
    'SC001',
    'SC002',
    'SC006',
  ]);
  expect(visibleIssues(f.controller.state)).toHaveLength(3);
  f.controller.configure(true, false);
  expect(visibleIssues(f.controller.state).map((issue) => issue.code)).toEqual([
    'SC001',
    'SC002',
  ]);
  f.controller.configure(true, true);
  const warning = f.controller.state.report!.issues[0]!.key;
  f.controller.dismiss(warning);
  expect(visibleIssues(f.controller.state)).toHaveLength(3);
  const advisory = f.controller.state.report!.issues[2]!.key;
  f.controller.dismiss(advisory);
  expect(visibleIssues(f.controller.state).map((issue) => issue.code)).toEqual([
    'SC001',
    'SC002',
  ]);
  f.controller.restore();
  expect(visibleIssues(f.controller.state)).toHaveLength(3);
  f.controller.dispose();
});

it('marks edited results stale, refuses them, and recomputes on refresh', () => {
  const f = harness('@ALICE\n(Hello?)\n');
  f.controller.run();
  expect(f.controller.state.phase).toBe('current');
  const edited = f.state.applyTransaction(f.state.tr.insertText('X', 1)).state;
  const changed = {
    session: editorOrigin(edited).session,
    version: editorVersion(edited),
    doc: edited.doc,
  };
  const stale = new ScriptCheckController(() => changed, vi.fn());
  stale.setProjection({
    phase: 'current',
    projection: { ...f.projection, ...changed } as ManuscriptProjection,
    message: '',
  });
  expect(stale.state.phase).toBe('pending');
  expect(stale.state.report).toBeNull();
  // A controller holding results over a changed document shows them stale.
  f.controller.setProjection({
    phase: 'current',
    projection: { ...f.projection, ...changed } as ManuscriptProjection,
    message: '',
  });
  expect(f.controller.state.phase).toBe('stale');
  expect(f.controller.state.report!.issues).toHaveLength(2);
  // The retained projection still matches its own stamp; the stale phase is
  // what refuses navigation until Refresh recomputes.
  expect(f.controller.isCurrent()).toBe(true);
  // A capture in flight keeps retained results without flashing stale.
  const transient = new ScriptCheckController(
    () => ({
      session: editorOrigin(f.state).session,
      version: editorVersion(f.state),
      doc: f.state.doc,
    }),
    vi.fn(),
  );
  transient.setProjection({
    phase: 'current',
    projection: f.projection,
    message: '',
  });
  transient.run();
  expect(transient.state.phase).toBe('current');
  transient.setProjection({ phase: 'pending', projection: null, message: '' });
  expect(transient.state.phase).toBe('current');
  expect(transient.state.report!.issues).toHaveLength(2);
  transient.dispose();
  stale.dispose();
  f.controller.dispose();
});

it('rebases selection-only drift on the identical document without stale-ing', () => {
  let live = createEditorState(new TextEncoder().encode('@ALICE\n(Hello?)\n'));
  const stamp = () => ({
    session: editorOrigin(live).session,
    version: editorVersion(live),
    doc: live.doc,
  });
  const projection = {
    ...stamp(),
    snapshot: { capture: captureEditor(live) },
    rows: [],
    sourceSha256: 'test',
  } as unknown as ManuscriptProjection;
  const controller = new ScriptCheckController(stamp, vi.fn());
  controller.setProjection({ phase: 'current', projection, message: '' });
  controller.run();
  expect(controller.state.phase).toBe('current');
  live = live.applyTransaction(
    live.tr.setSelection(TextSelection.create(live.doc, 1)),
  ).state;
  expect(live.doc).toBe(controller.state.projection!.doc);
  const rebased = {
    ...stamp(),
    snapshot: { capture: captureEditor(live) },
    rows: [],
    sourceSha256: 'test',
  } as unknown as ManuscriptProjection;
  controller.setProjection({
    phase: 'current',
    projection: rebased,
    message: '',
  });
  expect(controller.state.phase).toBe('current');
  expect(controller.state.projection).toBe(rebased);
  expect(controller.state.report!.issues).toHaveLength(2);
  controller.dispose();
});

it('keeps scene-number and spacing advice advisory, bounded and dismissible-shaped', () => {
  expect(check('.INT. X - DAY #1#\n.INT. Y - DAY #1#\n').issues).toMatchObject([
    { code: 'SC006', severity: 'advisory', line: 0 },
  ]);
  expect(codes('.INT. X - DAY #1#\n.INT. Y - DAY #2#\n')).toEqual([]);
  expect(check('!A.\n\n\n\n!B.\n').issues).toMatchObject([
    { code: 'SC007', severity: 'advisory', line: 1, endLine: 3 },
  ]);
  expect(codes('!A.\n\n!B.\n')).toEqual([]);
  expect(MAX_CHECK_ISSUES).toBeGreaterThan(0);
});
