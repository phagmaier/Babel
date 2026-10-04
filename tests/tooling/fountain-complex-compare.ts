/** Offline interoperability tooling, never imported by production. Node 26 type stripping. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseFountain,
  replaceLine,
  replaceLineWithBreaks,
  replaceTitleField,
  serializeFountain,
  setDualDialogue,
} from '../../src/domain/fountainCodec.ts';
import { richView } from '../../src/domain/fountainInline.ts';
import type {
  FountainDocument,
  LineEdit,
  SourceLineEdit,
  StyledText,
} from '../../src/domain/fountainModel.ts';
import {
  digest,
  fixtureBytes,
  loadCorpus,
  type SourceOracle,
} from '../../prototypes/fountain-conformance/corpus.ts';

interface ComplexCase {
  id: string;
  source: string;
  sourceSha256: string;
  edited: string;
  editedSha256: string;
  operation: {
    type: string;
    field?: number;
    key?: string;
    values?: string[];
    region?: number;
    content?: string[];
    left?: number;
    right?: number;
    line?: number;
    runs?: StyledText[];
    texts?: string[];
    from?: number;
    count?: number;
    edits?: SourceLineEdit[];
  };
  before: {
    title?: { key: string; values: string[] }[];
    runs?: StyledText[][];
  };
  after: ComplexCase['before'];
  renderer: { shared: boolean; gaps: string[] };
}
interface RendererRow {
  id: string;
  atoms: Record<string, unknown>[];
  title: Record<string, string[]>;
  runs: StyledText[][];
  html: string;
  htmlText: string;
  htmlCounts?: Record<string, number>;
  htmlStyles?: StyledText[];
}
const [python, directory] = process.argv.slice(2);
if (!python || !directory)
  throw new Error(
    'Usage: node fountain-complex-compare.ts <pinned-venv-python> <disposable-output>',
  );
const corpus = loadCorpus();
const complex: { schema: number; cases: ComplexCase[] } = JSON.parse(
  readFileSync('fixtures/expected/m3-complex.json', 'utf8'),
);
assert.equal(complex.schema, 1);
const submissions: { id: string; source: string }[] = [];
const checks = new Map<
  string,
  {
    document: FountainDocument;
    original?: SourceOracle;
    complex?: ComplexCase['before'];
    shared: boolean;
  }
>();
let sourceChecks = 0;
const historicalEditedSamples: string[] = [];
function submit(
  id: string,
  document: FountainDocument,
  original?: SourceOracle,
  complexExpected?: ComplexCase['before'],
  shared = true,
) {
  assert(!checks.has(id), `Duplicate comparison ${id}`);
  submissions.push({
    id,
    source: new TextDecoder('utf8', { ignoreBOM: true }).decode(document.bytes),
  });
  checks.set(id, { document, original, complex: complexExpected, shared });
}
for (const entry of corpus.cases) {
  const original = parseFountain(fixtureBytes(entry));
  const versions: {
    id: string;
    document: FountainDocument;
    oracle: SourceOracle;
  }[] = [{ id: entry.id, document: original, oracle: entry }];
  if (entry.edit)
    versions.push({
      id: entry.id + ':edit',
      document: replaceLine(original, entry.edit.line, {
        kind: entry.edit.kind as LineEdit['kind'],
        text: entry.edit.text,
      }),
      oracle: entry.edit,
    });
  for (const { id, document, oracle } of versions) {
    assert.deepEqual(serializeFountain(document), fixtureBytes(oracle), id);
    const atoms = document.lines
      .filter((line) => line.kind !== 'blank')
      .map(({ kind, text, titleKey, sectionLevel, sceneNumber, dualWith }) => ({
        kind,
        text,
        ...(titleKey === undefined ? {} : { titleKey }),
        ...(sectionLevel === undefined ? {} : { sectionLevel }),
        ...(sceneNumber === undefined ? {} : { sceneNumber }),
        ...(dualWith === undefined ? {} : { dualWith }),
      }));
    assert.deepEqual(atoms, oracle.proofAtoms, `${id}: literal semantics`);
    sourceChecks++;
    if (oracle.renderer)
      submit(
        id,
        document,
        oracle,
        undefined,
        entry.shared || entry.id === 'emphasis',
      );
  }
}
for (const entry of complex.cases) {
  assert.equal(digest(Buffer.from(entry.source)), entry.sourceSha256);
  assert.equal(digest(Buffer.from(entry.edited)), entry.editedSha256);
  const original = parseFountain(Buffer.from(entry.source));
  const op = entry.operation;
  let after: FountainDocument;
  switch (op.type) {
    case 'title':
      after = replaceTitleField(
        original,
        original.titleFields[op.field!]!.id,
        op.key!,
        op.values!,
      );
      break;
    case 'hidden':
    case 'inline':
    case 'conversion':
      // Independent historical literal, not evidence of a live editor operation.
      historicalEditedSamples.push(entry.id);
      after = parseFountain(Buffer.from(entry.edited));
      break;
    case 'dual':
      after = setDualDialogue(
        original,
        original.dialogueGroups[op.right!]!.id,
        original.dialogueGroups[op.left!]!.id,
      );
      break;
    case 'break':
      after = replaceLineWithBreaks(original, op.line!, op.texts!);
      break;
    default:
      throw new Error('Unknown literal operation');
  }
  assert.equal(
    Buffer.from(serializeFountain(original)).toString('utf8'),
    entry.source,
  );
  assert.equal(
    Buffer.from(serializeFountain(after)).toString('utf8'),
    entry.edited,
  );
  sourceChecks += 2;
  if (entry.renderer.shared) {
    submit('complex:' + entry.id, original, undefined, entry.before);
    submit('complex:' + entry.id + ':edit', after, undefined, entry.after);
  }
}
const response = spawnSync(
  python,
  ['prototypes/fountain-conformance/renderer.py'],
  {
    input: JSON.stringify(submissions),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
  },
);
if (response.error || response.status !== 0)
  throw new Error(
    `Independent renderer failed: ${response.error?.message ?? response.stderr}`,
  );
const parsed: { renderer: string; entries: RendererRow[] } = JSON.parse(
  response.stdout,
);
assert.equal(parsed.renderer, corpus.rendererPin);
assert.equal(parsed.entries.length, checks.size);
const seen = new Set<string>();
let agreements = 0;
function portable(document: FountainDocument) {
  const atoms: Record<string, unknown>[] = [];
  const runs: StyledText[][] = [];
  const cueAtoms = new Map<number, number>();
  for (const [index, line] of document.lines.entries()) {
    if (
      ['blank', 'title', 'titleContinuation', 'note', 'boneyard'].includes(
        line.kind,
      )
    )
      continue;
    assert.notEqual(
      line.kind,
      'raw',
      'Shared comparison cannot discard an unsupported raw source row',
    );
    if (line.kind === 'character') cueAtoms.set(index, atoms.length);
    const atom: Record<string, unknown> = {
      kind: line.kind,
      text:
        line.kind === 'pageBreak' ? '===' : (line.inline?.text ?? line.text),
    };
    if (line.sceneNumber !== undefined) atom.sceneNumber = line.sceneNumber;
    if (line.sectionLevel !== undefined) atom.sectionLevel = line.sectionLevel;
    if (line.dualWith !== undefined) {
      assert(cueAtoms.has(line.dualWith));
      atom.dualWith = cueAtoms.get(line.dualWith);
    }
    atoms.push(atom);
    if (line.inline) runs.push(richView(line.inline.runs));
  }
  const title: Record<string, string[]> = {};
  for (const field of document.titleFields) {
    const values = field.values.map((value) => value.text);
    if (values[0] === '' && values.length > 1) values.shift();
    // Repeated fields are outside this renderer's metadata-map subset; literal order is retained in the domain.
    assert(
      !Object.hasOwn(title, field.key),
      'Duplicate title key is outside shared renderer projection',
    );
    title[field.key] = values;
  }
  return { atoms, runs, title };
}
for (const actual of parsed.entries) {
  const check = checks.get(actual.id);
  assert(
    check && !seen.has(actual.id),
    `Unknown/duplicate renderer result: ${actual.id}`,
  );
  seen.add(actual.id);
  const oracle = check.original?.renderer;
  if (oracle) {
    assert.deepEqual(
      actual.atoms,
      oracle.atoms,
      actual.id + ': independent atom oracle',
    );
    assert.deepEqual(
      actual.title,
      oracle.title ?? {},
      actual.id + ': independent title oracle',
    );
    assert.equal(
      actual.htmlText,
      oracle.htmlText,
      actual.id + ': independent rendered text',
    );
    if (oracle.runs)
      assert.deepEqual(
        actual.runs,
        oracle.runs,
        actual.id + ': independent run oracle',
      );
    if (oracle.htmlStyles)
      assert.deepEqual(
        actual.htmlStyles,
        oracle.htmlStyles,
        actual.id + ': independent HTML style oracle',
      );
    for (const [name, count] of Object.entries(oracle.htmlCounts ?? {}))
      assert.equal(
        actual.htmlCounts?.[name],
        count,
        actual.id + ': HTML ' + name,
      );
  }
  if (check.complex?.runs)
    assert.deepEqual(
      actual.runs.map(richView),
      check.complex.runs,
      actual.id + ': independent complex run oracle',
    );
  if (check.complex?.title) {
    const expected = Object.fromEntries(
      check.complex.title.map(({ key, values }) => [
        key,
        values[0] === '' && values.length > 1 ? values.slice(1) : values,
      ]),
    );
    assert.deepEqual(
      actual.title,
      expected,
      actual.id + ': independent complex title oracle',
    );
  }
  if (check.shared) {
    const domain = portable(check.document);
    assert.deepEqual(
      domain.atoms,
      actual.atoms,
      actual.id + ': production/renderer atoms',
    );
    assert.deepEqual(
      domain.runs,
      actual.runs.map(richView),
      actual.id + ': production/renderer runs',
    );
    assert.deepEqual(
      domain.title,
      actual.title,
      actual.id + ': production/renderer title',
    );
    agreements++;
  }
}
const report = {
  task: 'M3-03',
  scope:
    'Production codec and independent historical parser samples against pinned Screenplain AST/actual bare HTML; no production PDF/editor/native flow',
  sourceChecks,
  historicalEditedSamples,
  rendererChecks: seen.size,
  agreements,
  gaps: [
    ...corpus.cases
      .filter((entry) => entry.gaps.length)
      .map(({ id, gaps }) => ({ id, gaps })),
    ...complex.cases
      .filter((entry) => entry.renderer.gaps.length)
      .map(({ id, renderer }) => ({
        id: 'complex:' + id,
        gaps: renderer.gaps,
      })),
  ],
  results: parsed,
};
mkdirSync(directory, { recursive: true });
writeFileSync(
  resolve(directory, 'comparison.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `PASS: ${sourceChecks} literal source checks (${historicalEditedSamples.length} historical edited parser samples); ${seen.size} independent renderer checks; ${agreements} full supported atom/run/title agreements. Report: ${resolve(directory, 'comparison.json')}`,
);
