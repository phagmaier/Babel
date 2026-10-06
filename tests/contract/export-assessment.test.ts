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

// Review of AUDIT-D04-R2/R1: branches the shared corpus cannot show through
// PDF text alone. Renderer readings confirmed with a parse-level probe.
it('AUDIT-DEV-REVIEW reports an empty @ cue only where the renderer prints it, and the whole dropped title range', () => {
  const messages = (source: string) => {
    const result = assess(source);
    if (result.status !== 'verified') throw new Error('unavailable');
    return result.issues.map((issue) => [
      issue.line,
      issue.endLine,
      issue.message,
    ]);
  };
  const emptyCue = expect.stringContaining('empty “@” cue');
  // Inside an action paragraph the renderer prints "@" and the speech as action.
  expect(messages('A lamp.\n@ \nHello.\n')).toContainEqual([1, 1, emptyCue]);
  // Opening a speech paragraph, "@ " is an empty cue on both sides; "@" and a
  // tab expands to a cue ending in spaces, which the renderer does not read.
  const tabbed = expect.stringContaining('two spaces or a tab');
  expect(messages('@ \nHello.\n')).not.toContainEqual([0, 0, emptyCue]);
  expect(messages('@\t\nHello.\n')).toContainEqual([0, 0, tabbed]);
  // "> " and ">\t" print nothing; only a lone ">" prints its marker.
  for (const source of ['A lamp.\n\n> \n', 'A lamp.\n\n>\t\n'])
    expect(messages(source)).toEqual([]);
  // The renderer attributes every line from the indented key on to that key.
  expect(
    messages('Title: A\nContact: Sam\n    Tel:\n    555 0100\n\n!Body.\n'),
  ).toEqual([[2, 3, expect.stringContaining('separate title field')]]);
  // A tab stop is measured in characters, as the renderer counts them: after
  // three it is one space (still a cue), after four it is four spaces.
  expect(messages('.INT. A\n\n@Z😀\t\nHello.\n')).not.toContainEqual([
    2,
    2,
    tabbed,
  ]);
  expect(messages('.INT. A\n\n@Zo😀\t\nHello.\n')).toContainEqual([
    2,
    2,
    tabbed,
  ]);
});

// AUDIT-D04-R3: reasons and ranges the shared corpus cannot show. Every renderer
// reading here was confirmed with a parse-level probe of the pinned runtime.
it('AUDIT-D04-R3 states why the printed role differs, on the lines that differ', () => {
  const messages = (source: string) => {
    const result = assess(source);
    if (result.status !== 'verified') throw new Error('unavailable');
    return result.issues.map((issue) => [
      issue.line,
      issue.endLine,
      issue.message,
    ]);
  };
  const has = (text: string) => expect.stringContaining(text);
  // A deleted boneyard leaves an empty line: the line beside it stands alone.
  expect(messages('A lamp.\n/* cut */\nINT. LAB - DAY\n\nIt hums.\n')).toEqual([
    [2, 2, has('deletes a boneyard on its own line')],
  ]);
  expect(messages('A lamp.\n/* cut */\nINT. LAB - DAY\n\nIt hums.\n')).toEqual([
    [2, 2, has('print it as a scene heading')],
  ]);
  expect(messages('A lamp.\n/* cut */\nFADE TO:\n')).toEqual([
    [2, 2, has('print it as a transition')],
  ]);
  expect(messages('A lamp.\n\n#Act\n/* cut */\n')).toEqual([
    [2, 2, has('treat it as a section heading and omit it')],
  ]);
  expect(messages('A lamp.\n/* cut */\nMAYA\nHello.\n')).toEqual([
    [2, 3, has('a paragraph starts at “MAYA”')],
  ]);
  // The first line of the deleted boneyard is the one above the heading.
  expect(messages('A lamp.\n/* a\nb\nc */\nEXT. ROOF\n')).toEqual([
    [4, 4, has('print it as a scene heading')],
  ]);
  // Two boneyards on one line leave one space: still an empty line.
  expect(messages('A lamp.\n\n/* a */ /* b */\nEXT. ROOF\n')).toContainEqual([
    3,
    3,
    has('print it as a scene heading'),
  ]);
  // A line of spaces, a tab or a no-break space does not end the paragraph.
  for (const blank of ['   ', '\t', ' \t', '\u00a0'])
    expect(messages(`A lamp.\n\nMAYA\n${blank}\nShe waits.\n`)).toEqual([
      [2, 4, has('read through the line of spaces or tabs')],
    ]);
  // An empty line and a single space do, on both sides.
  for (const blank of ['', ' '])
    expect(messages(`A lamp.\n\nMAYA\n${blank}\nShe waits.\n`)).toEqual([]);
  // The bracket rule runs per speech and reports each run of lines.
  expect(messages('MAYA\n(a\nb)\nHello.\n(c\nd\n')).toEqual([
    [1, 2, has('until one ends with “)”')],
    [4, 5, has('until one ends with “)”')],
  ]);
  expect(messages('MAYA\nHi.\n\nJON ^\n(a\nb\n')).toEqual([
    [4, 5, has('parenthetical indent')],
  ]);
  // Emphasis around the bracket does not hide it; an escaped star does.
  for (const line of ['*(low)*', '**(low)**', '_(low)_', '_*(low)*_'])
    expect(messages(`MAYA\n${line}\nHello.\n`)).toEqual([
      [1, 1, has('even inside emphasis markers')],
    ]);
  for (const line of ['\\*(low)\\*', 'x (low)', '*x* (low)'])
    expect(messages(`MAYA\n${line}\nHello.\n`)).toEqual([]);
  // Scene numbers: the renderer needs no space before and allows any after.
  for (const heading of ['INT. LAB #7# ', 'INT. LAB#7#', 'INT. LAB #7#\t'])
    expect(messages(`${heading}\n\nA lamp.\n`)).toEqual([
      [0, 0, has('print 7 in the margins')],
    ]);
  expect(messages('INT. LAB #7#\n\nA lamp.\n')).toEqual([]);
  // A bare prefix, or one followed by anything but a space or period.
  for (const heading of ['INT ', 'EXT\t', 'I/E  ', 'INT/EXT ', 'INT\u00a0LAB'])
    expect(messages(`${heading}\n\nA lamp.\n`)).toEqual([
      [0, 0, has('followed by a period, or by a space and more text')],
    ]);
  for (const heading of ['INT.', 'INT. ', 'INT./EXT ', 'I/E. '])
    expect(messages(`${heading}\n\nA lamp.\n`)).toEqual([]);
  // A single period forces a heading for the renderer, whatever follows it.
  for (const line of ['. hello', '.-- later', '."Quote"', '. #1#'])
    expect(messages(`A lamp.\n\n${line}\n\nIt hums.\n`)).toEqual([
      [2, 2, has('starts with a single period')],
    ]);
  for (const line of ['.', '. ', '..', '...and then'])
    expect(messages(`A lamp.\n\n${line}\n\nIt hums.\n`)).toEqual([]);
  // The period is the reason even beside a boneyard.
  expect(messages('/* b */\n. hello\n')).toEqual([
    [1, 1, has('starts with a single period')],
  ]);
  // Cue rules: capitals before the first bracket, lyric or not.
  expect(messages('A lamp.\n\n~LA LA\n~la la\n')).toEqual([
    [2, 3, has('even when it is a lyric')],
  ]);
  expect(messages('A lamp.\n\n~LA LA\n')).toEqual([]);
  expect(messages('MAYA (to Jon) quietly\nHello.\n')).toEqual([
    [0, 1, has('the text before its first bracket is in capitals')],
  ]);
  expect(messages('(MAYA)\nHello.\n')).toEqual([
    [0, 1, has('only where capitals come before its first bracket')],
  ]);
  for (const line of ['TO:', ' TO:', '3 TO:'])
    expect(messages(`A lamp.\n\n${line}\n\nIt hums.\n`)).toEqual([
      [2, 2, has('capital letters come before the closing “TO:”')],
    ]);
  // A paragraph an earlier limitation reports is left to it.
  expect(messages('.INT. A - DAY\n!Action.\n')).toHaveLength(1);
  // The opening block: a boneyard on its own line ends it for the renderer.
  expect(messages(' Title: Night\n/* b */\nMaya waits.\n')).toEqual([
    [0, 0, has('reads this opening block as a title page')],
  ]);
  expect(messages(' Title: Night\n  /* b */\nMaya waits.\n')).toEqual([]);
});

it('AUDIT-D04-R3 does not summarise a section or synopsis the renderer prints', () => {
  // "INT " is action for the renderer, so the synopsis below it is printed.
  const printed = assess('INT \n\n= Maya decides.\n\nA lamp.\n');
  if (printed.status !== 'verified') throw new Error('unavailable');
  expect(printed.omissions.synopses.count).toBe(0);
  expect(printed.issues.map((issue) => issue.line)).toEqual([0, 2]);
  const attached = assess('INT.\n\n= Maya decides.\n\nA lamp.\n');
  if (attached.status !== 'verified') throw new Error('unavailable');
  expect(attached.omissions.synopses.count).toBe(1);
  expect(attached.issues).toEqual([]);
});

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

// AUDIT-EXPORT-WARNINGS. What the author is told is what export may later hear
// from the renderer. The corpus's `warnings` are checked against the pinned
// helper in tests/differential/renderer.test.ts.
const warningCorpus = JSON.parse(
  readFileSync('fixtures/assessment/export-warnings.json', 'utf8'),
) as {
  cases: {
    name: string;
    source: string;
    warnings: string[];
    announced: string[];
    review: boolean;
    exports: boolean;
  }[];
};
it.each([
  [
    ' FADE IN: [[cold open]]\n\nA lamp glows.\n',
    0,
    0,
    'opening block as a title page',
  ],
  [
    'Title: A Story\n Draft date: 1\n\nA lamp glows.\n',
    1,
    1,
    'would not print',
  ],
  [
    'Title: A /* hidden */ Story\n Draft date: 1\n\nA lamp glows.\n',
    1,
    1,
    'would not print',
  ],
  [
    'Title: A\n Sub:\n    secret value\nAuthor: Sam\n\nA lamp glows.\n',
    1,
    2,
    'would not print',
  ],
] as const)(
  'R5 locates omitted title text without changing BOM/CRLF source: %s',
  (text, line, endLine, message) => {
    const doc = parse('\ufeff' + text.replaceAll('\n', '\r\n'));
    const before = Array.from(serializeFountain(doc));
    const result = evaluateExportAssessment(doc, context);
    if (result.status !== 'verified') throw new Error('unavailable');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'SC005',
        severity: 'blocking',
        line,
        endLine,
        sourceStart: doc.lines[line]!.sourceStart,
        sourceEnd: doc.lines[endLine]!.contentEnd,
        message: expect.stringContaining(message),
        hasFix: false,
      }),
    );
    expect(result.announced).toContain('unknown-title-fields');
    expect(Array.from(serializeFountain(doc))).toEqual(before);
  },
);
it.each([
  ['A lamp glows.\n\n# Act One\n/* old */\n\nThe end.\n', 2, 'section heading'],
  [
    'INT. ROOM - DAY\n\n[[fix this scene]]\n\n= They argue.\n\nA lamp glows.\n',
    4,
    'synopsis',
  ],
] as const)('R5 describes an actually omitted %s', (source, line, kind) => {
  const result = assess(source);
  if (result.status !== 'verified') throw new Error('unavailable');
  const issue = result.issues.find((entry) => entry.line === line);
  expect(issue).toMatchObject({
    code: 'SC005',
    severity: 'blocking',
    endLine: line,
  });
  expect(issue!.message).toContain(kind);
  expect(issue!.message).toContain('omit');
  expect(issue!.message).not.toContain('would print');
});
it.each(warningCorpus.cases)(
  'AUDIT-EXPORT-WARNINGS announced: $name',
  ({ source, warnings, announced, review, exports }) => {
    // Sorted in the helper's order, so the lists compare directly.
    expect([...announced].sort()).toEqual(announced);
    const doc = parse(source);
    const before = Array.from(serializeFountain(doc));
    const report = evaluateScriptCheck(doc, {
      ...context,
      layout: assessmentLayoutProbes(doc).map(() => null),
    });
    const assessment = report.exportAssessment;
    if (assessment.status !== 'verified') throw new Error('unavailable');
    expect(assessment.announced).toEqual(announced);
    expect(Object.isFrozen(assessment.announced)).toBe(true);
    expect(requiresExportReview(report)).toBe(review);
    // The corpus is consistent: a PDF may be published exactly when every
    // renderer warning was announced.
    expect(warnings.every((warning) => announced.includes(warning))).toBe(
      exports,
    );
    // Whatever the summary line counts is announced.
    const counted = {
      boneyards: assessment.omissions.boneyards.count,
      notes: assessment.omissions.notes.count,
      sections: assessment.omissions.sections.count,
      synopses: assessment.omissions.synopses.count,
    };
    for (const [category, count] of Object.entries(counted))
      if (count) expect(announced).toContain(category);
    expect(Array.from(serializeFountain(doc))).toEqual(before);
  },
);
it('AUDIT-EXPORT-WARNINGS announces nothing for limitations that say the text prints', () => {
  for (const [source, announced] of [
    // Printed as text, as action, in capitals, or refused for its glyphs.
    ['INT. LAB - DAY\n\nAn *unpaired star and {{raw}} text.\n', []],
    ['int. lab - day\n\nA lamp glows.\n', []],
    ['INT. LAB - DAY\n\nA lamp 😀 glows.\n', []],
    ['Title: Film\nINT. LAB - DAY\n\nA lamp glows.\n', []],
    // A section or synopsis is non-printing by definition: the limitation on
    // it announces its own kind, should the renderer omit it after all.
    ['INT. LAB - DAY\n\n# Act\nA lamp glows.\n', ['sections']],
    ['INT. LAB - DAY\n\nA lamp glows.\n\n= Not attached.\n', ['synopses']],
  ] as const) {
    const result = assess(source);
    if (result.status !== 'verified') throw new Error('unavailable');
    expect(result.issues.length, source).toBeGreaterThan(0);
    expect(result.announced, source).toEqual(announced);
  }
});
