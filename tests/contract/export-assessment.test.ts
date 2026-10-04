import { TextSelection } from 'prosemirror-state';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  assessmentLayoutProbes,
  describeOmissions,
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';
import {
  evaluateScriptCheck,
  requiresExportReview,
} from '../../src/domain/scriptCheck';
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
  // The independently reviewed omitted lines are unchanged; AUDIT-D04 only
  // splits them into the gated unknown title field and the non-blocking summary.
  expect(result.issues.map((issue) => issue.line)).toEqual([0]);
  expect(
    result.omissions.ranges.map((range) => [
      range.kind,
      range.line,
      range.endLine,
    ]),
  ).toEqual([
    ['section', 2, 2],
    ['synopsis', 3, 3],
    ['note', 7, 7],
    ['boneyard', 9, 9],
  ]);
  expect(
    [
      ...result.issues.map((issue) => issue.line),
      ...result.omissions.ranges.map((range) => range.line),
    ].sort((a, b) => a! - b!),
  ).toEqual([0, 2, 3, 7, 9]);
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
    issues: [
      // AUDIT-D04-R1: an indented line after a valued key makes the pinned
      // renderer print the whole block, keys included, as script text.
      { code: 'SC005', line: 0, endLine: 2 },
      { code: 'SC005', line: 1, endLine: 2 },
    ],
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
    issues: [],
    omissions: {
      notes: { count: 1, lines: 1 },
      boneyards: { count: 1, lines: 1 },
    },
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
    parse(Array(1002).fill('{{raw}}\n').join('')),
    context,
  );
  expect(result.truncated).toBe(true);
  expect(result.issues).toHaveLength(1000);
  expect(result.exportAssessment).toMatchObject({ truncated: true });
  // Omitted elements are summarised and no longer consume the issue budget.
  const sections = evaluateScriptCheck(
    parse(Array(1002).fill('# Section\n').join('')),
    context,
  );
  expect(sections.truncated).toBe(false);
  expect(sections.issues).toEqual([]);
  expect(sections.exportAssessment).toMatchObject({
    truncated: false,
    omissions: { sections: { count: 1002, lines: 1002 } },
  });
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
  // The inline note is a summarised omission; only visible scalars are checked.
  expect(result.issues.some((issue) => issue.code === 'SC005')).toBe(false);
  expect(result.omissions.notes).toEqual({ count: 1, lines: 1 });
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

// AUDIT-D04. The same hand-authored corpus is checked against PDFs rendered by
// the pinned helper in tools/pdf-helper/test_helper.py.
const oracle = JSON.parse(
  readFileSync('fixtures/assessment/oracle.json', 'utf8'),
) as {
  cases: {
    name: string;
    source: string;
    clean: boolean;
    blockingLines: number[];
    omissions: Record<'notes' | 'boneyards' | 'sections' | 'synopses', number>;
  }[];
};
it.each(oracle.cases)(
  'AUDIT-D04 oracle: $name',
  ({ source, clean, blockingLines, omissions }) => {
    const doc = parse(source);
    const before = Array.from(serializeFountain(doc));
    const report = evaluateScriptCheck(doc, {
      ...context,
      layout: assessmentLayoutProbes(doc).map(() => null),
    });
    const assessment = report.exportAssessment;
    if (assessment.status !== 'verified') throw new Error('unavailable');
    expect(assessment.layout).toBe('verified');
    expect(requiresExportReview(report)).toBe(!clean);
    if (clean)
      expect(
        report.issues.filter((issue) => issue.severity !== 'advisory'),
      ).toEqual([]);
    for (const line of blockingLines)
      expect(
        assessment.issues.some(
          (issue) =>
            issue.severity === 'blocking' &&
            issue.line !== null &&
            issue.line <= line &&
            line <= issue.endLine,
        ),
        `line ${line} must stay gated`,
      ).toBe(true);
    expect({
      notes: assessment.omissions.notes.count,
      boneyards: assessment.omissions.boneyards.count,
      sections: assessment.omissions.sections.count,
      synopses: assessment.omissions.synopses.count,
    }).toEqual(omissions);
    // Assessment never changes or re-serializes the author's bytes.
    expect(Array.from(serializeFountain(doc))).toEqual(before);
  },
);

it('AUDIT-D04 summarises omissions with counts and line totals in one sentence', () => {
  const result = assess(
    '# One\n\n# Two\n\n.INT. A - DAY\n\n= Beat.\n\n[[first\nsecond\nthird]]\n\n!Body [[aside]] text.\n\n/* cut\nmore */\n\n!End.\n',
  );
  if (result.status !== 'verified') throw new Error('unavailable');
  expect(result.issues).toEqual([]);
  expect(result.omissions).toMatchObject({
    notes: { count: 2, lines: 4 },
    boneyards: { count: 1, lines: 2 },
    sections: { count: 2, lines: 2 },
    synopses: { count: 1, lines: 1 },
  });
  expect(describeOmissions(result.omissions)).toBe(
    'Not printed by this profile: 2 notes (4 lines), 1 boneyard (2 lines), 2 section headings, 1 synopsis.',
  );
  const none = assess('!Body.\n');
  if (none.status !== 'verified') throw new Error('unavailable');
  expect(describeOmissions(none.omissions)).toBe('');
});

it('AUDIT-D04 assesses a speech through its inline note and keeps original byte targets', () => {
  const source =
    '@MAYA\nYou kept the light on. [[check tone]]\nAfter everything.\n\n{{raw}}\n';
  const doc = parse(source);
  // The codec still protects the mixed line; only assessment sees through it.
  expect(doc.lines[1]!.kind).toBe('raw');
  const probes = assessmentLayoutProbes(doc);
  expect(probes).toEqual([
    {
      line: 0,
      endLine: 2,
      source: '@MAYA\nYou kept the light on. \nAfter everything.\n',
    },
  ]);
  const report = evaluateScriptCheck(doc, { ...context, layout: [null] });
  expect(report.issues.map((issue) => [issue.code, issue.line])).toEqual([
    ['SC004', 4],
    ['SC005', 4],
  ]);
  const raw = report.issues.find((issue) => issue.code === 'SC005')!;
  expect(raw.sourceStart).toBe(doc.lines[4]!.sourceStart);
  expect(raw.sourceEnd).toBe(doc.lines[4]!.contentEnd);
  expect(new TextDecoder().decode(doc.bytes)).toBe(source);
});

it('AUDIT-D04 keeps many inline notes exportable instead of truncating', () => {
  const report = evaluateScriptCheck(
    parse(
      Array.from({ length: 1002 }, () => '!A [[private note]] light.\n\n').join(
        '',
      ),
    ),
    { ...context, layout: [] },
  );
  expect(report.truncated).toBe(false);
  expect(report.issues).toEqual([]);
  expect(report.exportAssessment).toMatchObject({
    status: 'verified',
    truncated: false,
    omissions: { notes: { count: 1002, lines: 1002 } },
  });
});
