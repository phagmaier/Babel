/** M3-01 proof data loader, never an application codec or oracle generator. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Document, Kind } from '../fountain/codec.ts';

export interface Atom {
  kind: Kind;
  text: string;
  titleKey?: string;
  sectionLevel?: number;
  sceneNumber?: string;
  dualWith?: number;
}
export interface RendererOracle {
  atoms: Atom[];
  htmlText: string;
  title?: Record<string, string[]>;
  runs?: { text: string; styles: string[] }[][];
  htmlStyles?: { text: string; styles: string[] }[];
  htmlCounts?: Record<string, number>;
}
export interface SourceOracle {
  file: string;
  sourceLiteral: string;
  sha256: string;
  proofAtoms: Atom[];
  renderer: RendererOracle | null;
}
export interface CorpusCase extends SourceOracle {
  id: string;
  topics: string[];
  requirements: string[];
  shared: boolean;
  gaps: string[];
  required: string[];
  edit?: SourceOracle & { line: number; kind: Kind; text: string };
}
export interface Corpus {
  schema: number;
  provenance: string;
  reference: string;
  rendererPin: string;
  cases: CorpusCase[];
  invalidUtf8: { file: string; hex: string; sha256: string };
}

export const digest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
export function fixtureBytes(oracle: SourceOracle): Uint8Array {
  if (!/^m3-[a-z-]+(?:\.edited)?\.fountain$/.test(oracle.file))
    throw new Error('Unexpected corpus filename');
  const bytes = new Uint8Array(
    readFileSync(resolve('fixtures/fountain', oracle.file)),
  );
  if (
    digest(bytes) !== oracle.sha256 ||
    !Buffer.from(bytes).equals(Buffer.from(oracle.sourceLiteral, 'utf8'))
  )
    throw new Error(`Literal/hash mismatch: ${oracle.file}`);
  return bytes;
}
export function loadCorpus(): Corpus {
  const corpus: Corpus = JSON.parse(
    readFileSync('fixtures/expected/m3-conformance.json', 'utf8'),
  );
  if (corpus.schema !== 1 || corpus.rendererPin !== '0.12.0')
    throw new Error('Unsupported corpus schema/pin');
  const ids = new Set<string>();
  for (const entry of corpus.cases) {
    if (ids.has(entry.id)) throw new Error('Duplicate corpus case');
    ids.add(entry.id);
    fixtureBytes(entry);
    if (entry.edit) fixtureBytes(entry.edit);
    if (!entry.shared && entry.gaps.length === 0)
      throw new Error(`Undeclared comparison exclusion: ${entry.id}`);
  }
  return corpus;
}

/** Full nonseparator line semantics of the M1 proof; inline syntax stays literal.
 * Source/blank/line-ending completeness is asserted separately against exact bytes.
 * dualWith references the original physical source line, not a guessed speaker name.
 */
export function proofAtoms(document: Document): Atom[] {
  return document.lines
    .filter((line) => line.kind !== 'blank')
    .map(({ kind, text, titleKey, sectionLevel, sceneNumber, dualWith }) => ({
      kind,
      text,
      ...(titleKey === undefined ? {} : { titleKey }),
      ...(sectionLevel === undefined ? {} : { sectionLevel }),
      ...(sceneNumber === undefined ? {} : { sceneNumber }),
      ...(dualWith === undefined ? {} : { dualWith }),
    }));
}

/** Shared comparison uses ordered atom indices for the dual relationship. */
export function sharedAtoms(document: Document): Atom[] {
  const physicalToAtom = new Map<number, number>();
  let atomIndex = 0;
  document.lines.forEach((line, index) => {
    if (line.kind !== 'blank') physicalToAtom.set(index, atomIndex++);
  });
  return proofAtoms(document).map((atom) => {
    if (atom.dualWith === undefined) return atom;
    const dualWith = physicalToAtom.get(atom.dualWith);
    if (dualWith === undefined) throw new Error('Dangling dual relationship');
    return { ...atom, dualWith };
  });
}
