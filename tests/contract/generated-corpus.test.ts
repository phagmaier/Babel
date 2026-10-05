import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  gaps,
  mixedCorpus,
  mixedSize,
  prefixes,
  suffixes,
  tokens,
} from '../differential/generated-corpus';

const corpus = mixedCorpus();

it('the supplemental corpus repeats exactly and retains at least 60,000 distinct sources', () => {
  expect(corpus.inputs).toHaveLength(mixedSize);
  expect(mixedCorpus().inputs).toEqual(corpus.inputs);
  expect(new Set(corpus.inputs).size).toBeGreaterThanOrEqual(60000);
  // Independently replayed in Python; source ordering and bytes are frozen.
  expect(
    createHash('sha256').update(JSON.stringify(corpus.inputs)).digest('hex'),
  ).toBe('d67a2b81fa7924ec2eb73248da69f450354ee6029b2fdb4aefa86b72020583fb');
});

it('all 60 tokens, whitespace choices and 1–7 authored-row counts are exercised', () => {
  expect(tokens).toHaveLength(60);
  expect(corpus.coverage.tokens.filter((n) => n > 0)).toHaveLength(
    tokens.length,
  );
  expect(corpus.coverage.prefixes.filter((n) => n > 0)).toHaveLength(
    prefixes.length,
  );
  expect(corpus.coverage.suffixes.filter((n) => n > 0)).toHaveLength(
    suffixes.length,
  );
  expect(corpus.coverage.gaps.filter((n) => n > 0)).toHaveLength(gaps.length);
  expect(corpus.coverage.rowCounts.every((n) => n >= 9000)).toBe(true);
});

it('token choices mix across consecutive rows, every position and opening indentation', () => {
  expect(corpus.coverage.tokenPairs.size).toBe(tokens.length ** 2);
  expect(corpus.coverage.positions.flat().every((n) => n >= 100)).toBe(true);
  expect(corpus.coverage.openings.flat().every((n) => n >= 200)).toBe(true);
});
