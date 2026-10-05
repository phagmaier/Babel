import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as baselineCodec from '@baseline/domain/fountainCodec';
import { rendererReading as baselineReading } from '@baseline/domain/rendererReading';
import * as baseAssessment from '@baseline/domain/exportAssessment';
import * as assessment from '../../src/domain/exportAssessment';
import { parseFountain } from '../../src/domain/fountainCodec';
import type { FountainDocument } from '../../src/domain/fountainModel';
import {
  rendererReading,
  type RendererReading,
} from '../../src/domain/rendererReading';

function facts(reading: RendererReading) {
  return {
    title: reading.title !== null,
    paragraphs: reading.paragraphs.flatMap((p): unknown[] => {
      if (p.kind === 'heading') return [['heading', p.sceneNumber ?? null]];
      if (p.kind === 'action' || p.kind === 'centered')
        return [[p.kind, p.roles.length]];
      if (p.kind === 'speech')
        return [['speech', p.roles.slice(1).map((r) => r === 'parenthetical')]];
      if (p.kind === 'sections')
        return p.roles.filter((r) => r === 'section').map(() => ['section']);
      if (p.kind === 'synopsis') return [];
      return [[p.kind]];
    }),
  };
}
function differs(document: FountainDocument, reading: RendererReading) {
  const kinds: Record<string, string> = {
    heading: 'sceneHeading',
    cue: 'character',
  };
  if (document.titleFields.length > 0 !== (reading.title !== null)) return true;
  return reading.paragraphs.some((p) =>
    p.rows.some((row, i) => {
      const line = document.lines[row]!;
      if (['blank', 'note', 'boneyard'].includes(line.kind)) return false;
      const role = p.roles[i]!;
      return (
        line.kind !== (kinds[role] ?? role) ||
        (role === 'heading' &&
          (line.sceneNumber?.toUpperCase() ?? null) !== (p.sceneNumber ?? null))
      );
    }),
  );
}

// Fixed seed and ASCII token vocabulary: reproducible source-grammar coverage,
// not the lost original scratch generator and not layout/emphasis/pixel proof.
function sources() {
  const tokens = [
    'INT. ROOF - DAY',
    'EXT. PARK #12#',
    'INT ',
    'CUT TO:',
    'TO:',
    '.hello',
    '!Alpha.',
    'MAYA',
    '@maya',
    '@',
    '(beat)',
    '(beat',
    'Bye.',
    '# Act',
    '= Sum',
    '===',
    '>CUT TO:',
    '>center<',
    '~Song',
    '/* bone */',
    '[[note]]',
    'Title: Film',
    'Title:',
    'Contact: Sam',
    '    Tel: 555',
    'FADE IN:',
    'MAYA ^',
    'A sentence.',
    '**(beat)**',
    'x #1#',
  ];
  const prefixes = ['', '', ' ', '\t'];
  const suffixes = ['', '', ' ', '  ', '\t'];
  const gaps = ['\n', '\n\n', '\n \n', '\n  \n', '\n\t\n'];
  let seed = 0x104d04;
  const pick = (size: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % size;
  };
  const generated: string[] = [];
  for (let i = 0; i < 70000; i++) {
    let source = '';
    const count = 1 + pick(6);
    for (let row = 0; row < count; row++)
      source +=
        (row ? gaps[pick(gaps.length)]! : '') +
        prefixes[pick(prefixes.length)]! +
        tokens[pick(tokens.length)]! +
        suffixes[pick(suffixes.length)]!;
    generated.push(source + '\n');
  }
  return generated;
}

// AUDIT-D04-R4. The frozen control passes these clean although the pinned
// renderer drops or re-reads their opening block (retained PDFs; the oracle
// states what prints). Gating them is the reviewed correction, not a false
// gate. The list is exact: no other source may move, and none may move back.
const correctedByD04R4 = [
  ' FADE IN:\n\t\n /* bone */\t\n',
  ' FADE IN: \n\t\n /* bone */\t\n',
  ' CUT TO:\t\n\t\n /* bone */\t\n',
  ' CUT TO: \n\t\n /* bone */\t\n',
  ' CUT TO:  \n\t\n /* bone */\t\n',
  ' FADE IN:\n\t\n /* bone */\t\n\nA lamp glows.\n',
  'FADE IN:\n\t\n\t/* bone */\n\nA lamp glows.\n',
  'FADE IN:\n\t\n\t/* bone */\n    Maya waits.\n\nA lamp glows.\n',
  'Title: Night \\/* Shift\n    Sub: late\n\nA lamp glows.\n',
  'Title: Night \\/* Shift\n    late edition\n\nA lamp glows.\n',
];

it('shared corpus and 70,000 generated sources introduce no pinned-parser reading disagreement', () => {
  const corpus = JSON.parse(
    readFileSync('fixtures/assessment/oracle.json', 'utf8'),
  ) as { cases: { source: string }[] };
  const inputs = [...corpus.cases.map((c) => c.source), ...sources()];
  const oracle = JSON.parse(
    execFileSync('python3', ['tools/differential/renderer_oracle.py'], {
      input: JSON.stringify(inputs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 150000,
    }),
  ) as ({ title: boolean; paragraphs: unknown[] } | { refused: string })[];
  expect(oracle).toHaveLength(inputs.length);
  const regressions: unknown[] = [];
  const falseGates: unknown[] = [];
  const corrected: string[] = [];
  const assessmentRegressions: unknown[] = [];
  let baselineRoleCandidates = 0;
  const baselineRoleExamples: unknown[] = [];
  // Report only: every occurrence, so review can deduplicate and account for
  // each one. It changes no predicate, assertion, seed or baseline.
  const baselineRoleOccurrences: unknown[] = [];
  const existing: unknown[] = [];
  let equal = 0,
    refused = 0;
  for (const [index, source] of inputs.entries()) {
    const actual = oracle[index]!;
    if ('refused' in actual) {
      refused++;
      continue;
    }
    const bytes = new TextEncoder().encode(source);
    const oldDoc = baselineCodec.parseFountain(bytes);
    const nowDoc = parseFountain(bytes);
    const oldView = baseAssessment.assessmentView(oldDoc).document;
    const nowView = assessment.assessmentView(nowDoc).document;
    const oldReading = baselineReading(oldView.lines);
    const nowReading = rendererReading(nowView.lines);
    const old = facts(oldReading);
    const now = facts(nowReading);
    const context = {
      identity: assessment.PUBLICATION_ASSESSMENT_IDENTITY,
      version: 1,
      sourceSha256: 'a'.repeat(64),
    };
    const oldCheck = baseAssessment.evaluateExportAssessment(oldDoc, context);
    const nowCheck = assessment.evaluateExportAssessment(nowDoc, context);
    const clean = (check: typeof nowCheck) =>
      check.status === 'verified' &&
      !check.issues.some((issue) => issue.severity === 'blocking');
    if (
      clean(oldCheck) &&
      JSON.stringify(old) === JSON.stringify(actual) &&
      !clean(nowCheck)
    )
      (correctedByD04R4.includes(source) ? corrected : falseGates).push(source);
    const oldCleanDifference =
      clean(oldCheck) &&
      (JSON.stringify(old) !== JSON.stringify(actual) ||
        differs(oldView, oldReading));
    const nowCleanDifference =
      clean(nowCheck) &&
      (JSON.stringify(now) !== JSON.stringify(actual) ||
        differs(nowView, nowReading));
    if (oldCleanDifference) {
      baselineRoleCandidates++;
      baselineRoleOccurrences.push({
        index,
        origin: index < corpus.cases.length ? 'oracle' : 'generated',
        source,
        current: nowCleanDifference,
      });
      if (baselineRoleExamples.length < 5)
        baselineRoleExamples.push({
          source,
          lines: oldView.lines.map((l) => [l.kind, l.text, l.sceneNumber]),
          reading: oldReading,
        });
    }
    if (nowCleanDifference && !oldCleanDifference)
      assessmentRegressions.push(source);
    const expected = JSON.stringify(actual);
    if (JSON.stringify(old) === expected) {
      equal++;
      if (JSON.stringify(now) !== expected)
        regressions.push({ source, actual, now });
    } else if (JSON.stringify(now) !== expected)
      existing.push({ source, actual, now });
  }
  console.log(
    JSON.stringify({
      sources: inputs.length,
      equal,
      refused,
      existing: existing.length,
      newDisagreements: regressions.length,
    }),
  );
  if (existing.length)
    console.log(
      'Frozen-control disagreements (not new):',
      JSON.stringify(existing.slice(0, 5)),
    );
  expect(equal).toBeGreaterThan(50000);
  expect(refused).toBe(0);
  expect(existing.slice(0, 10)).toEqual([]);
  expect(regressions.slice(0, 10)).toEqual([]);
  expect(falseGates.slice(0, 10)).toEqual([]);
  expect(assessmentRegressions.slice(0, 10)).toEqual([]);
  expect([...new Set(corrected)].sort()).toEqual([...correctedByD04R4].sort());
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + '.renderer.json',
      JSON.stringify({
        sources: inputs.length,
        uniqueSources: new Set(inputs).size,
        equal,
        refused,
        existing: existing.length,
        newDisagreements: regressions.length,
        newFalseGates: falseGates.length,
        reviewedCorrections: corrected.length,
        newCleanDisagreements: assessmentRegressions.length,
        existingExamples: existing.slice(0, 5),
        baselineRoleCandidates,
        baselineRoleExamples,
        baselineRoleOccurrences,
      }),
      { flag: 'wx' },
    );
});

// AUDIT-EXPORT-WARNINGS. Export stops on a helper warning the assessment did
// not announce, so every warning the pinned helper really reports here must be
// announced: an unannounced one is a silent omission, or a stop the author
// could never clear. The hand-authored corpus states its warnings literally
// and names the open findings (`exports: false`), the only sources allowed to
// stop. Clear one by reporting it in the assessment, never by widening
// `announced`. The reverse direction is reported, not asserted: the helper
// does not warn about an empty synopsis.
it('shared corpora and 70,000 generated sources leave no pinned-helper warning unannounced beyond the named open findings', () => {
  const read = (path: string) =>
    JSON.parse(readFileSync(path, 'utf8')) as {
      cases: { source: string; warnings?: string[]; exports?: boolean }[];
    };
  const shared = read('fixtures/assessment/oracle.json').cases;
  const authored = read('fixtures/assessment/export-warnings.json').cases;
  const inputs = [...authored, ...shared].map((c) => c.source);
  inputs.push(...sources());
  const reported = JSON.parse(
    execFileSync('python3', ['tools/differential/warning_oracle.py'], {
      input: JSON.stringify(inputs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 150000,
    }),
  ) as (string[] | { refused: string })[];
  expect(reported).toHaveLength(inputs.length);
  const prefix = 'unsupported-publication:';
  const categories: readonly string[] = assessment.OMISSION_CATEGORIES;
  const seen = Object.fromEntries(
    categories.map((category) => [category, { summary: 0, issue: 0 }]),
  );
  const unannounced: { source: string; missing: string[] }[] = [];
  const unwarned: { source: string; counted: string[] }[] = [];
  let refused = 0;
  for (const [index, source] of inputs.entries()) {
    const actual = reported[index]!;
    if (!Array.isArray(actual)) {
      refused++;
      continue;
    }
    // An unprefixed or unknown code stays as it is and is never announced.
    const warned = actual.map((code) =>
      code.startsWith(prefix) ? code.slice(prefix.length) : code,
    );
    if (index < authored.length)
      expect(warned, source).toEqual(authored[index]!.warnings);
    const check = assessment.evaluateExportAssessment(
      parseFountain(new TextEncoder().encode(source)),
      {
        identity: assessment.PUBLICATION_ASSESSMENT_IDENTITY,
        version: 1,
        sourceSha256: 'a'.repeat(64),
      },
    );
    if (check.status !== 'verified') throw new Error('unavailable: ' + source);
    const announced: readonly string[] = check.announced;
    const counted = [
      check.omissions.boneyards.count ? 'boneyards' : '',
      check.omissions.notes.count ? 'notes' : '',
      check.omissions.sections.count ? 'sections' : '',
      check.omissions.synopses.count ? 'synopses' : '',
    ].filter(Boolean);
    const missing = warned.filter((category) => !announced.includes(category));
    if (missing.length) unannounced.push({ source, missing });
    for (const category of warned)
      if (announced.includes(category))
        seen[category]![counted.includes(category) ? 'summary' : 'issue']++;
    const silent = counted.filter((category) => !warned.includes(category));
    if (silent.length) unwarned.push({ source, counted: silent });
  }
  console.log(
    JSON.stringify({
      sources: inputs.length,
      refused,
      unannounced: unannounced.length,
      unwarned: unwarned.length,
      seen,
    }),
  );
  expect(refused).toBe(0);
  // Exactly the open findings the hand-authored corpus names, no other source.
  const open = authored.filter((c) => c.exports === false);
  expect(
    unannounced.slice(0, open.length + 10).map((found) => found.source),
  ).toEqual(open.map((c) => c.source));
  // Not vacuous: each category is announced without a count, and each counted
  // kind by the summary, somewhere the helper really warns.
  for (const category of categories) {
    expect(seen[category]!.issue, category).toBeGreaterThan(0);
    if (category !== 'unknown-title-fields')
      expect(seen[category]!.summary, category).toBeGreaterThan(0);
  }
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + '.warnings.json',
      JSON.stringify({
        sources: inputs.length,
        uniqueSources: new Set(inputs).size,
        refused,
        unannounced,
        announcedWhereWarned: seen,
        countedButNotWarned: unwarned.length,
        countedButNotWarnedExamples: unwarned.slice(0, 5),
      }),
      { flag: 'wx' },
    );
});
