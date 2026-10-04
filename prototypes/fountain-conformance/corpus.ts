/** M3-01 proof data loader, never an application codec or oracle generator. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FountainKind } from '../../src/domain/fountainModel.ts';

export interface Atom {
  kind: FountainKind;
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
  edit?: SourceOracle & { line: number; kind: FountainKind; text: string };
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
