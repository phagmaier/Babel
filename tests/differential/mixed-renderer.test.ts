import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as baselineCodec from '@baseline/domain/fountainCodec';
import { rendererReading as baselineReading } from '@baseline/domain/rendererReading';
import * as baseAssessment from '@baseline/domain/exportAssessment';
import * as assessment from '../../src/domain/exportAssessment';
import { parseFountain } from '../../src/domain/fountainCodec';
import type { FountainDocument } from '../../src/domain/fountainModel';
import type { RendererReading } from '../../src/domain/rendererReading';
import { mixedCorpus, mixedSeed } from './generated-corpus';

// Frozen runs in renderer.test.ts stay intact. Both supplemental gates consume
// this identical ordered corpus; no filtering or deduplication before parsing.
const { inputs, coverage } = mixedCorpus();
const corpusSha256 = createHash('sha256')
  .update(JSON.stringify(inputs))
  .digest('hex');
const dispositions = JSON.parse(
  readFileSync('tests/differential/mixed-findings.json', 'utf8'),
) as {
  corpusSha256: string;
  admissionChanges: { source: string; finding: string }[];
  retained: Record<string, { count: number; sha256: string; finding: string }>;
};
const context = {
  identity: assessment.PUBLICATION_ASSESSMENT_IDENTITY,
  version: 1,
  sourceSha256: 'a'.repeat(64),
};
const ordered = <T>(entries: T[]) =>
  entries.sort((a, b) => {
    const left = JSON.stringify(a),
      right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
// Counts plus hashes pin every ordered source and its independent oracle
// outcome, including duplicate occurrences. They retain bugs, not waivers:
// unexplained changes fail; correcting one needs a separately reviewed task.
function retained(name: string, entries: unknown[]) {
  const { count, sha256 } = dispositions.retained[name]!;
  expect(
    {
      count: entries.length,
      sha256: createHash('sha256')
        .update(JSON.stringify(entries))
        .digest('hex'),
    },
    name,
  ).toEqual({ count, sha256 });
}
function report(suffix: string, results: object) {
  const summary = {
    origin: 'mixed',
    seed: mixedSeed,
    sources: inputs.length,
    uniqueSources: new Set(inputs).size,
    corpusSha256,
    coverage: { ...coverage, tokenPairs: coverage.tokenPairs.size },
    ...results,
  };
  console.log(
    JSON.stringify({
      origin: 'mixed',
      sources: inputs.length,
      uniqueSources: summary.uniqueSources,
      corpusSha256,
      ...Object.fromEntries(
        Object.entries(results).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.length : value,
        ]),
      ),
    }),
  );
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + suffix,
      JSON.stringify(summary),
      { flag: 'wx' },
    );
}
function oracle<T>(tool: string): T[] {
  return JSON.parse(
    execFileSync('python3', [`tools/differential/${tool}_oracle.py`], {
      input: JSON.stringify(inputs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 150000,
    }),
  ) as T[];
}

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

it('70,000 mixed sources retain identified parser limits without introducing reading regressions', () => {
  expect(corpusSha256).toBe(dispositions.corpusSha256);
  const actual = oracle<
    { title: boolean; paragraphs: unknown[] } | { refused: string }
  >('renderer');
  expect(actual).toHaveLength(inputs.length);
  const refused: unknown[] = [];
  const disagreements: {
    source: string;
    pinned: { title: boolean; paragraphs: unknown[] };
    now: ReturnType<typeof facts>;
    old: ReturnType<typeof facts>;
  }[] = [];
  const regressions: unknown[] = [];
  const titleCorrections: { source: string; pinned: unknown }[] = [];
  const markerCorrections: { source: string; pinned: unknown }[] = [];
  const newCleanDisagreements: string[] = [];
  const admissionChanges: string[] = [];
  const baselineRoleOccurrences: unknown[] = [];
  for (const [index, source] of inputs.entries()) {
    const pinned = actual[index]!;
    if ('refused' in pinned) {
      refused.push({ index, source, ...pinned });
      continue;
    }
    const bytes = new TextEncoder().encode(source);
    const oldDoc = baselineCodec.parseFountain(bytes);
    const nowDoc = parseFountain(bytes);
    const oldView = baseAssessment.assessmentView(oldDoc).document;
    const nowView = assessment.assessmentView(nowDoc).document;
    const oldReading = baselineReading(oldView.lines);
    const nowReading = assessment.assessmentReading(nowDoc);
    const old = facts(oldReading);
    const now = facts(nowReading);
    const oldCheck = baseAssessment.evaluateExportAssessment(oldDoc, context);
    const nowCheck = assessment.evaluateExportAssessment(nowDoc, context);
    const clean = (check: typeof nowCheck) =>
      check.status === 'verified' &&
      !check.issues.some((issue) => issue.severity === 'blocking');
    const oldMatches = JSON.stringify(old) === JSON.stringify(pinned);
    const nowMatches = JSON.stringify(now) === JSON.stringify(pinned);
    if (!oldMatches && nowMatches) {
      (old.title !== pinned.title ? titleCorrections : markerCorrections).push({
        source,
        pinned,
      });
    }
    if (!nowMatches) disagreements.push({ source, pinned, now, old });
    if (oldMatches && !nowMatches) regressions.push(source);
    if (clean(oldCheck) && oldMatches && !clean(nowCheck))
      admissionChanges.push(source);
    const oldDifference =
      clean(oldCheck) && (!oldMatches || differs(oldView, oldReading));
    const nowDifference =
      clean(nowCheck) && (!nowMatches || differs(nowView, nowReading));
    if (oldDifference)
      baselineRoleOccurrences.push({ index, source, current: nowDifference });
    if (nowDifference && !oldDifference) newCleanDisagreements.push(source);
  }
  report('.mixed-renderer.json', {
    refused,
    disagreements,
    titleCorrections,
    markerCorrections,
    regressions,
    newCleanDisagreements,
    admissionChanges,
    baselineRoleOccurrences,
  });
  retained('unpaired-dual', refused);
  // R5 corrects the exact 398 previously retained title-source outcomes. This
  // keeps their old source/oracle hash while requiring full current agreement.
  retained('corrected-title-reading', titleCorrections);
  // AUDIT-MARKER-READING: the six literal source/oracle outcomes retain their
  // historical hash while requiring full agreement, separate from title fixes.
  retained('corrected-marker-reading', markerCorrections);
  // Every discovered disagreement also exists on the untouched control.
  // Compare every fact, not merely the number of disagreements.
  for (const entry of disagreements)
    expect(entry.now, entry.source).toEqual(entry.old);
  for (const [name, titleDiffers] of [
    ['title-reading', true],
    ['marker-paragraphs', false],
  ] as const)
    retained(
      name,
      disagreements
        .filter(
          (entry) => (entry.now.title !== entry.pinned.title) === titleDiffers,
        )
        .map(({ source, pinned }) => ({ source, pinned })),
    );
  expect(regressions).toEqual([]);
  expect(newCleanDisagreements).toEqual([]);
  // Exact reviewed source inventory, separate from the frozen ten corrections.
  expect(ordered([...new Set(admissionChanges)])).toEqual(
    ordered(dispositions.admissionChanges.map((entry) => entry.source)),
  );
});

it('the same 70,000 mixed sources expose only explicitly retained helper-warning gaps', () => {
  expect(corpusSha256).toBe(dispositions.corpusSha256);
  const actual = oracle<string[] | { refused: string }>('warning');
  expect(actual).toHaveLength(inputs.length);
  const refused: unknown[] = [];
  const unknown: unknown[] = [];
  const unannounced: { source: string; missing: string[] }[] = [];
  const unwarned: unknown[] = [];
  const seen = Object.fromEntries(
    assessment.OMISSION_CATEGORIES.map((category) => [
      category,
      { summary: 0, issue: 0 },
    ]),
  );
  for (const [index, source] of inputs.entries()) {
    const warnings = actual[index]!;
    if (!Array.isArray(warnings)) {
      refused.push({ index, source, ...warnings });
      continue;
    }
    const warned = warnings.map((code) =>
      code.replace(/^unsupported-publication:/, ''),
    );
    if (
      warnings.some((code) => !code.startsWith('unsupported-publication:')) ||
      warned.some(
        (category) =>
          !(assessment.OMISSION_CATEGORIES as readonly string[]).includes(
            category,
          ),
      )
    )
      unknown.push({ source, warnings });
    const check = assessment.evaluateExportAssessment(
      parseFountain(new TextEncoder().encode(source)),
      context,
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
  report('.mixed-warnings.json', {
    refused,
    unknown,
    unannounced,
    announcedWhereWarned: seen,
    countedButNotWarned: unwarned,
  });
  expect(refused).toEqual([]);
  expect(unknown).toEqual([]);
  // The complete report remains readable; fingerprints pin every source and
  // missing category without a broad pattern-based exception.
  for (const category of ['unknown-title-fields', 'notes', 'boneyards'])
    retained(
      `unannounced-${category}`,
      unannounced.filter((entry) => entry.missing.includes(category)),
    );
  expect(
    unannounced.every(
      (entry) =>
        entry.missing.length === 1 &&
        ['unknown-title-fields', 'notes', 'boneyards'].includes(
          entry.missing[0]!,
        ),
    ),
  ).toBe(true);
  for (const category of assessment.OMISSION_CATEGORIES) {
    expect(seen[category]!.issue, category).toBeGreaterThan(0);
    if (category !== 'unknown-title-fields')
      expect(seen[category]!.summary, category).toBeGreaterThan(0);
  }
});
