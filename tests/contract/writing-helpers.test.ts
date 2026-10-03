import { expect, it } from 'vitest';
import {
  toSessionSelection,
  writingFailureMessage,
} from '../../src/app/writingHelpers';

it('maps an Error to its message', () => {
  expect(writingFailureMessage(new Error('boom'))).toBe('boom');
});

it('maps each known failure code to its user-facing text', () => {
  const cases: Array<[string, string]> = [
    ['checkpointConflict', 'Recovery contains a different draft'],
    ['staleRecoveryVersion', 'Recovery holds a newer version'],
    ['recoveryNeedsAttention', 'Existing recovery needs review'],
    ['invalidDestination', 'unavailable or unsafe'],
    ['sourceChanged', 'changed outside this session'],
    ['permissionDenied', 'choose a writable copy destination'],
    ['io', 'storage operation failed'],
    ['historyNeedsAttention', 'Local history needs attention'],
  ];
  for (const [code, fragment] of cases) {
    expect(writingFailureMessage({ code })).toContain(fragment);
    expect(writingFailureMessage({ error: { code } })).toContain(fragment);
  }
});

it('keeps nested error codes over top-level codes', () => {
  expect(
    writingFailureMessage({ code: 'io', error: { code: 'permissionDenied' } }),
  ).toContain('choose a writable copy destination');
});

it('falls back for unknown and missing codes without losing the draft promise', () => {
  expect(writingFailureMessage({ code: 'nope' })).toContain('(nope)');
  expect(writingFailureMessage({ code: 'nope' })).toContain(
    'Your text stays open',
  );
  expect(writingFailureMessage(null)).toBe(
    'The action could not be confirmed. Your text stays open.',
  );
  expect(writingFailureMessage(undefined)).toBe(
    'The action could not be confirmed. Your text stays open.',
  );
});

it('reads plain offsets from the live selection', () => {
  const view = { state: { selection: { anchor: 3, head: 9 } } };
  expect(
    toSessionSelection(
      view as unknown as Parameters<typeof toSessionSelection>[0],
    ),
  ).toEqual({ anchor: 3, head: 9 });
});
