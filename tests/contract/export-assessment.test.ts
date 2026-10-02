import { TextSelection } from 'prosemirror-state';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  assessmentLayoutProbes,
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';
import { evaluateScriptCheck } from '../../src/domain/scriptCheck';
import {
  ScriptCheckController,
  visibleIssues,
} from '../../src/application/scriptCheck';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';
const parse = (source: string) =>
  parseFountain(new TextEncoder().encode(source));
const context = { identity, version: 7, sourceSha256: 'a'.repeat(64) };
const assess = (source: string) =>
  evaluateExportAssessment(parse(source), context);

it('maps the independently reviewed omission corpus using codec boundaries and preserves BOM/CRLF', () => {
  const data = readFileSync('fixtures/publication/omissions.fountain');
  const doc = parseFountain(data);
  const before = Array.from(serializeFountain(doc));
  const result = evaluateExportAssessment(doc, context);
  expect(result.status).toBe('verified');
  if (result.status !== 'verified') throw new Error('unavailable');
  expect(result.issues.map((issue) => issue.line)).toEqual([0, 2, 3, 7, 9]);
  expect(
    result.issues.every(
      (issue) =>
        issue.code === 'SC005' &&
        issue.severity === 'blocking' &&
        issue.hasFix === false,
    ),
  ).toBe(true);
  for (const issue of result.issues) {
    expect(issue.sourceStart).toBe(doc.lines[issue.line!]!.sourceStart);
    expect(issue.sourceEnd).toBe(doc.lines[issue.endLine]!.contentEnd);
  }
  expect(Array.from(serializeFountain(doc))).toEqual(before);
  expect(
    assess(
      '\ufeffTitle: Café\r\nArchive: 秘密\r\n   Extra value\r\n\r\n!Visible.\r\n',
    ),
  ).toMatchObject({
    status: 'verified',
    issues: [{ code: 'SC005', line: 1, endLine: 2 }],
  });
});

it('checks actual glyph tables in every emphasis face; accents and supported symbols pass', () => {
  expect(
    assess('!Café Zoë Ångström — € ©. *é* **ñ** ***ü***\n~Café\n'),
  ).toMatchObject({ status: 'verified', issues: [] });
  const result = assess('!中文 😀 אבג العربية हिन्दी\n');
  expect(result).toMatchObject({
    status: 'verified',
    version: 7,
    sourceSha256: context.sourceSha256,
  });
  if (result.status !== 'verified') throw new Error('unavailable');
  expect(
    result.issues.every((issue) => issue.code === 'SC008' && issue.line === 0),
  ).toBe(true);
  expect(result.issues.map((issue) => issue.message).join(' ')).toContain(
    'U+1F600',
  );
  expect(result.issues.map((issue) => issue.message).join(' ')).toContain(
    'U+4E2D',
  );
  expect(result.issues.map((issue) => issue.message).join(' ')).toContain(
    'unsupported shaping',
  );
  // Combining placement is a declared shaping restriction, separate from cmap coverage.
  expect(assess('!e\u0301\n')).toMatchObject({
    issues: [{ code: 'SC008', message: expect.stringContaining('shaping') }],
  });
  expect(
    assess('Title: 中文\nContact: 😀\n\n.INT. A - DAY #中#\n'),
  ).toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: 'SC008', line: 0 }),
    ]),
  });
});

it('uses source locations for raw content and reports omissions without checking hidden glyphs', () => {
  expect(assess('[[中文 😀]]\n/* العربية */\n!Body.\n')).toMatchObject({
    issues: [{ code: 'SC005' }, { code: 'SC005' }],
  });
  expect(assess('{{raw}}\n')).toMatchObject({ issues: [{ code: 'SC005' }] });
  expect(
    assess(
      'Title: A\nTitle: B\nAuthor: C\nAuthors: D\nCopyright: E\n\n!Body.\n',
    ),
  ).toMatchObject({ issues: [] });
});

it('fails closed on missing, altered, duplicate and malformed profile/font/renderer identities', () => {
  for (const candidate of [
    null,
    { ...identity, profile: 'other' },
    { ...identity, profileSha256: 'b'.repeat(64) },
    { ...identity, fontSet: 'fallback' },
    { ...identity, renderer: { ...identity.renderer, reportlab: 'future' } },
    { ...identity, fonts: identity.fonts.slice(1) },
    { ...identity, fonts: identity.fonts.map(() => identity.fonts[0]!) },
    {
      ...identity,
      fonts: identity.fonts.map((font) => ({
        ...font,
        sha256: 'b'.repeat(64),
      })),
    },
  ]) {
    expect(
      evaluateExportAssessment(parse('!Clean.\n'), {
        ...context,
        identity: candidate,
      }).status,
    ).toBe('unavailable');
  }
  expect(evaluateExportAssessment(parse('!Clean.\n')).status).toBe(
    'unavailable',
  );
  expect(
    evaluateExportAssessment(parse('!Clean.\n'), { ...context, version: 0 })
      .status,
  ).toBe('unavailable');
});

it('keeps geometry separate from guessed pagination and maps exact codec-selected dual ranges', () => {
  const doc = parseFountain(
    readFileSync('fixtures/publication/dual-overflow.fountain'),
  );
  const probes = assessmentLayoutProbes(doc);
  expect(probes).toHaveLength(1);
  expect(probes[0]!.source).toContain('^');
  const result = evaluateExportAssessment(doc, {
    ...context,
    layout: ['dual-dialogue-overflow'],
  });
  expect(result).toMatchObject({
    status: 'verified',
    layout: 'verified',
    issues: [
      { code: 'SC005', line: probes[0]!.line, endLine: probes[0]!.endLine },
    ],
  });
  expect(
    evaluateExportAssessment(doc, { ...context, layout: [null] }),
  ).toMatchObject({ issues: [] });
  expect(evaluateExportAssessment(doc, context)).toMatchObject({
    layout: 'unavailable',
  });
});

function harness(
  source: string,
  assessPort: import('../../src/application/exportAssessment').ExportAssessmentPort['assess'],
) {
  let state = createEditorState(new TextEncoder().encode(source));
  const stamp = () => ({
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
  });
  const projection = () =>
    ({
      ...stamp(),
      snapshot: { capture: captureEditor(state) },
      rows: [],
      sourceSha256: context.sourceSha256,
    }) as unknown as ManuscriptProjection;
  const controller = new ScriptCheckController(stamp, vi.fn(), {
    assess: assessPort,
  });
  const update = () =>
    controller.setProjection({
      phase: 'current',
      projection: projection(),
      message: '',
    });
  update();
  return {
    controller,
    update,
    select: () => {
      state = state.applyTransaction(
        state.tr.setSelection(TextSelection.create(state.doc, 2)),
      ).state;
      update();
    },
    edit: () => {
      state = state.applyTransaction(state.tr.insertText('X', 1)).state;
      update();
    },
  };
}

it('rejects stale replies, recomputes, rejects superseded replies and retains source authority', async () => {
  let resolve!: (value: {
    identity: typeof identity;
    layout: readonly (string | null)[];
  }) => void;
  const port = vi.fn(
    () =>
      new Promise<{
        identity: typeof identity;
        layout: readonly (string | null)[];
      }>((done) => {
        resolve = done;
      }),
  );
  const f = harness('!中文\n', port);
  f.controller.run();
  f.edit();
  resolve({ identity, layout: [] });
  await vi.waitFor(() => expect(f.controller.state.phase).toBe('stale'));
  expect(f.controller.state.report).toBeNull();
  f.controller.run();
  resolve({ identity, layout: [] });
  await vi.waitFor(() => expect(f.controller.state.phase).toBe('current'));
  expect(f.controller.state.report!.exportAssessment.status).toBe('verified');
  f.controller.configure(false, false);
  expect(
    visibleIssues(f.controller.state).every(
      (issue) => issue.severity === 'blocking',
    ),
  ).toBe(true);
  const key = visibleIssues(f.controller.state)[0]!.key;
  f.controller.dismiss(key);
  expect(
    visibleIssues(f.controller.state).some((issue) => issue.key === key),
  ).toBe(true);
  f.controller.run();
  const old = resolve;
  f.controller.run();
  resolve({ identity, layout: [] });
  await vi.waitFor(() => expect(f.controller.state.phase).toBe('current'));
  old({ identity: { ...identity, profile: 'wrong' }, layout: [] });
  await Promise.resolve();
  expect(f.controller.state.report!.exportAssessment.status).toBe('verified');
  f.controller.dispose();
});

it('reports unavailable on native failure and respects the result bound without permitting export success', async () => {
  const f = harness(
    '!Body.\n',
    vi.fn().mockRejectedValue(new Error('missing fonts')),
  );
  f.controller.run();
  await vi.waitFor(() => expect(f.controller.state.phase).toBe('current'));
  expect(f.controller.state.report!.exportAssessment.status).toBe(
    'unavailable',
  );
  f.controller.dispose();
  const result = evaluateScriptCheck(
    parse(Array(1002).fill('# Section\n').join('')),
    context,
  );
  expect(result.truncated).toBe(true);
  expect(result.issues).toHaveLength(1000);
  expect(result.exportAssessment).toMatchObject({ truncated: true });
});

it('declares codec/paragraph boundary mismatches instead of crediting silently changed roles', () => {
  expect(assess('Title: Test\n.INT. A - DAY\n')).toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: 'SC005', line: 0 }),
    ]),
  });
  expect(assess('!Action.\n@ALICE\nHello.\n')).toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: 'SC005', line: 1, endLine: 2 }),
    ]),
  });
  expect(assess('.INT. A - DAY\n!Action.\n')).toMatchObject({
    issues: [{ code: 'SC005', line: 0 }],
  });
  expect(assess('!Action.\n>Centered.<\n')).toMatchObject({
    issues: [{ code: 'SC005', line: 1 }],
  });
  expect(
    assess(
      'Title: Test\n\n.INT. A - DAY\n\n!Action.\n\n@ALICE\nHello.\n\n~Lyric.\n',
    ),
  ).toMatchObject({ issues: [] });
  // Source-supported short dual and all ordinary elements remain supported.
  for (const file of [
    'dual-first',
    'elements',
    'title',
    'speech-continuation',
  ]) {
    const path = `fixtures/publication/${file}.fountain`;
    const result = evaluateExportAssessment(
      parseFountain(readFileSync(path)),
      context,
    );
    expect(result).toMatchObject({ status: 'verified', issues: [] });
  }
});

it('checks visible Unicode beside hidden content without treating omitted scalars as rendered', () => {
  const result = assess('!中文 [[hidden 😀]] tail.\n');
  expect(result.status).toBe('verified');
  if (result.status !== 'verified') throw new Error('unavailable');
  expect(result.issues.some((issue) => issue.code === 'SC005')).toBe(true);
  const glyphs = result.issues.filter((issue) => issue.code === 'SC008');
  expect(glyphs).toHaveLength(2);
  expect(glyphs.map((issue) => issue.message).join(' ')).not.toContain(
    'U+1F600',
  );
});

it('rebases verified provenance on selection-only versions without another native probe', async () => {
  const port = vi.fn(async () => ({ identity, layout: [] }));
  const f = harness('!Café.\n', port);
  f.controller.run();
  await vi.waitFor(() => expect(f.controller.state.phase).toBe('current'));
  f.select();
  expect(f.controller.state.phase).toBe('current');
  expect(f.controller.state.report!.exportAssessment).toMatchObject({
    status: 'verified',
    version: f.controller.state.projection!.version,
  });
  expect(port).toHaveBeenCalledTimes(1);
  f.controller.dispose();
});

it('reserves the bounded display budget for export blockers before structural warnings', () => {
  const report = evaluateScriptCheck(parse('@ALICE\n'.repeat(1001)), context);
  expect(report.truncated).toBe(true);
  expect(report.issues).toHaveLength(1000);
  expect(report.issues.every((issue) => issue.severity === 'blocking')).toBe(
    true,
  );
});
