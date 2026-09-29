/** Run with Node 26's TypeScript stripping; no application/runtime dependency. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseFountain,
  replaceLine,
  unchangedBytes,
} from '../fountain/codec.ts';
import {
  fixtureBytes,
  loadCorpus,
  proofAtoms,
  sharedAtoms,
  type CorpusCase,
  type RendererOracle,
  type SourceOracle,
} from './corpus.ts';

const [python, outputDirectory] = process.argv.slice(2);
if (!python || !outputDirectory)
  throw new Error(
    'Usage: node compare.ts <pinned-venv-python> <disposable-output>',
  );
const corpus = loadCorpus();
const submissions: { id: string; source: string }[] = [];
const expected = new Map<
  string,
  { source: SourceOracle; entry: CorpusCase; renderer: RendererOracle }
>();
let sourceChecks = 0;
for (const entry of corpus.cases) {
  const before = parseFountain(fixtureBytes(entry));
  assert.deepEqual(unchangedBytes(before), fixtureBytes(entry), entry.id);
  assert.deepEqual(proofAtoms(before), entry.proofAtoms, entry.id);
  sourceChecks++;
  const versions: { id: string; source: SourceOracle }[] = [
    { id: entry.id, source: entry },
  ];
  if (entry.edit) {
    const edited = replaceLine(
      before,
      entry.edit.line,
      entry.edit.kind,
      entry.edit.text,
    );
    assert.deepEqual(
      edited.bytes,
      fixtureBytes(entry.edit),
      `${entry.id}:edit`,
    );
    assert.deepEqual(
      proofAtoms(edited),
      entry.edit.proofAtoms,
      `${entry.id}:edit`,
    );
    sourceChecks++;
    versions.push({ id: `${entry.id}:edit`, source: entry.edit });
  }
  for (const { id, source } of versions) {
    if (!source.renderer) continue;
    submissions.push({ id, source: source.sourceLiteral });
    expected.set(id, { source, entry, renderer: source.renderer });
  }
}
// Explicit executable and argv; manuscript text is only stdin, never shell code.
const result = spawnSync(
  python,
  ['prototypes/fountain-conformance/renderer.py'],
  {
    input: JSON.stringify(submissions),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
  },
);
if (result.error || result.status !== 0)
  throw new Error(`Renderer failed: ${result.error?.message ?? result.stderr}`);
const response = JSON.parse(result.stdout) as {
  renderer: string;
  entries: (RendererOracle & { id: string; html: string })[];
};
assert.equal(response.renderer, corpus.rendererPin);
assert.equal(response.entries.length, expected.size);
const seen = new Set<string>();
let commonChecks = 0;
for (const actual of response.entries) {
  const oracle = expected.get(actual.id);
  assert(
    oracle && !seen.has(actual.id),
    `Unknown/duplicate result: ${actual.id}`,
  );
  seen.add(actual.id);
  const { renderer, source, entry } = oracle;
  assert.deepEqual(
    actual.atoms,
    renderer.atoms,
    `${actual.id}: renderer atoms`,
  );
  assert.deepEqual(actual.title, renderer.title ?? {}, `${actual.id}: title`);
  assert.equal(
    actual.htmlText,
    renderer.htmlText,
    `${actual.id}: rendered text`,
  );
  if (renderer.runs)
    assert.deepEqual(actual.runs, renderer.runs, `${actual.id}: emphasis runs`);
  if (renderer.htmlStyles)
    assert.deepEqual(
      actual.htmlStyles,
      renderer.htmlStyles,
      `${actual.id}: HTML marks`,
    );
  for (const [key, count] of Object.entries(renderer.htmlCounts ?? {}))
    assert.equal(actual.htmlCounts?.[key], count, `${actual.id}: HTML ${key}`);
  if (entry.shared) {
    assert.deepEqual(
      sharedAtoms(parseFountain(fixtureBytes(source))),
      actual.atoms,
      `${actual.id}: codec/renderer agreement`,
    );
    commonChecks++;
  }
}
const report = {
  task: 'M3-01',
  scope:
    'M1 proof subset and pinned Screenplain AST/bare HTML; not production codec/PDF/native verification',
  fixtures: corpus.cases.flatMap((entry) => [
    { file: entry.file, sha256: entry.sha256 },
    ...(entry.edit
      ? [{ file: entry.edit.file, sha256: entry.edit.sha256 }]
      : []),
  ]),
  sourceChecks,
  rendererChecks: seen.size,
  commonChecks,
  gaps: corpus.cases
    .filter((entry) => entry.gaps.length)
    .map(({ id, gaps, required }) => ({ id, gaps, required })),
  results: response,
};
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, 'comparison.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `PASS: ${sourceChecks} exact-byte/semantic proof checks; ${seen.size} independent renderer checks; ${commonChecks} codec/renderer agreements.`,
);
console.log(
  `Explicit gaps: ${report.gaps.map((gap) => gap.id).join(', ')}. Report: ${resolve(outputDirectory, 'comparison.json')}`,
);
