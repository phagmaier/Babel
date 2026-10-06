import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryReview } from '../../src/app/RecoveryReview';
import type {
  RecoveryCandidate,
  RecoveryCatalog,
  RecoveryPort,
  RecoveryPreview,
} from '../../src/application/startupRecovery';

const bytes = Array.from(
  new TextEncoder().encode('<script>window.bad = true</script>\r\n  '),
);
const candidate: RecoveryCandidate = {
  selection: {
    documentId: '11111111-1111-4111-8111-111111111111',
    origin: 'current',
    recordSha256: 'a'.repeat(64),
  },
  sessionId: '22222222-2222-4222-8222-222222222222',
  version: 21,
  generation: 1,
  sourceSha256: 'b'.repeat(64),
  byteLength: bytes.length,
  encoding: 'utf8',
};
const catalog: RecoveryCatalog = {
  entries: [
    {
      documentId: candidate.selection.documentId,
      candidates: [candidate],
      notices: [],
      error: null,
    },
  ],
  truncated: false,
  unrecognizedArtifacts: 0,
};
function result(c = candidate, source = bytes): RecoveryPreview {
  return {
    candidate: c,
    source,
    metadata: {
      documentId: c.selection.documentId,
      sessionId: c.sessionId,
      version: c.version,
      generation: c.generation,
      sourceSha256: c.sourceSha256,
      baseFingerprint: null,
      draftMetadata: { unknown: true },
    },
  };
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
afterEach(cleanup);

describe('read-only startup recovery review', () => {
  it('inspects literal author text, exposes backup limits and defers without a write or another read', async () => {
    const preview = vi.fn(async () => result());
    const list = vi.fn(async () => catalog);
    const { container } = render(<RecoveryReview port={{ list, preview }} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Inspect published journal generation 1',
      }),
    );
    await waitFor(() =>
      expect(container.querySelector('pre')?.textContent).toBe(
        '<script>window.bad = true</script>\r\n  ',
      ),
    );
    expect(container.querySelector('script')).toBeNull();
    expect(preview).toHaveBeenCalledWith(candidate.selection);
    expect(screen.getByText(/not a separate backup/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Later' }));
    expect(screen.getByText('Recovery review deferred')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review checkpoints' }));
    expect(screen.getByText('Local recovery review')).toBeTruthy();
    expect(preview).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });
  it('shows damaged, pending and unknown material and incomplete scans without pretending there is a winner', async () => {
    const value: RecoveryCatalog = {
      ...catalog,
      truncated: true,
      unrecognizedArtifacts: 3,
      entries: [
        {
          ...catalog.entries[0]!,
          candidates: [],
          notices: [
            'truncatedTail',
            'pending',
            'unsupportedSchema',
            'conflictingGeneration',
          ],
          error: { code: 'checkpointConflict', action: 'retry' },
        },
      ],
    };
    render(
      <RecoveryReview
        port={{ list: async () => value, preview: async () => result() }}
      />,
    );
    expect(await screen.findByText(/This list is incomplete/)).toBeTruthy();
    expect(
      screen.getByText(/Earlier valid checkpoints remain available/),
    ).toBeTruthy();
    expect(screen.getByText(/completion is unconfirmed/)).toBeTruthy();
    expect(screen.getByText(/newer recovery format/)).toBeTruthy();
    expect(screen.getByText(/Both remain preserved/)).toBeTruthy();
    expect(screen.getByText(/No valid checkpoint is available/)).toBeTruthy();
  });
  it('renders malformed raw bytes as hex and never converts or repairs them', async () => {
    const c = { ...candidate, encoding: 'unsupported' as const, byteLength: 4 };
    const value = {
      ...catalog,
      entries: [{ ...catalog.entries[0]!, candidates: [c] }],
    };
    const { container } = render(
      <RecoveryReview
        port={{
          list: async () => value,
          preview: async () => result(c, [0, 255, 13, 10]),
        }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Inspect published/ }),
    );
    await waitFor(() =>
      expect(container.querySelector('pre')?.textContent).toBe('00 ff 0d 0a'),
    );
    expect(screen.getByText(/not valid UTF-8/)).toBeTruthy();
  });
  it('rejects a stale/mismatched preview and refreshes the catalog', async () => {
    const list = vi.fn(async () => catalog);
    render(
      <RecoveryReview
        port={{
          list,
          preview: async () => result({ ...candidate, generation: 2 }),
        }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Inspect published/ }),
    );
    expect(
      await screen.findByText(/changed or could not be read safely/),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh recovery list' }),
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
  it('ignores an old preview response after deferral', async () => {
    const pending = deferred<RecoveryPreview>();
    render(
      <RecoveryReview
        port={{ list: async () => catalog, preview: () => pending.promise }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Inspect published/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Later' }));
    pending.resolve(result());
    await waitFor(() =>
      expect(screen.getByText('Recovery review deferred')).toBeTruthy(),
    );
    expect(screen.queryByText(/Read-only checkpoint preview/)).toBeNull();
  });
  it('handles native failure visibly without displaying arbitrary transport text and offers retry', async () => {
    const list = vi
      .fn<RecoveryPort['list']>()
      .mockRejectedValueOnce(new Error('/private/manuscript detail'))
      .mockResolvedValueOnce({
        entries: [],
        truncated: false,
        unrecognizedArtifacts: 0,
      });
    render(<RecoveryReview port={{ list, preview: async () => result() }} />);
    expect(await screen.findByText('Recovery review unavailable')).toBeTruthy();
    expect(screen.queryByText(/private\/manuscript/)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry recovery review' }),
    );
    expect(
      await screen.findByText(/No recognized local checkpoints/),
    ).toBeTruthy();
  });
});

it('AUDIT-TEST resumes the exact reviewed selection as a new draft without adopting preview bytes', async () => {
  const onResume = vi.fn(),
    preview = vi.fn(async () => result());
  render(
    <RecoveryReview
      port={{ list: async () => catalog, preview }}
      onResume={onResume}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Resume as new draft/ }),
  );
  expect(onResume).toHaveBeenCalledExactlyOnceWith(candidate.selection);
  expect(preview).not.toHaveBeenCalled();
});

it('PILOT finding 2: Open latest version resumes the newest confirmed checkpoint, never a pending write', async () => {
  const onResume = vi.fn(),
    preview = vi.fn(async () => result());
  const at = (
    origin: RecoveryCandidate['selection']['origin'],
    version: number,
    mark: string,
  ): RecoveryCandidate => ({
    ...candidate,
    selection: {
      ...candidate.selection,
      origin,
      recordSha256: mark.repeat(64),
    },
    version,
    generation: version,
  });
  const newest = at('current', 30, 'c');
  const entries = [
    at('previous', 29, 'd'),
    newest,
    at('pending', 31, 'e'),
    at('previous', 30, 'f'),
  ];
  render(
    <RecoveryReview
      port={{
        list: async () => ({
          ...catalog,
          entries: [{ ...catalog.entries[0]!, candidates: entries }],
        }),
        preview,
      }}
      onResume={onResume}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Open latest version' }),
  );
  expect(onResume).toHaveBeenCalledExactlyOnceWith(newest.selection);
  expect(preview).not.toHaveBeenCalled();
  // Every checkpoint row and its own Resume action stay available.
  expect(
    screen.getAllByRole('button', { name: /Resume as new draft/ }),
  ).toHaveLength(4);
});

it('PILOT finding 2: no primary action when only unconfirmed pending writes exist', async () => {
  render(
    <RecoveryReview
      port={{
        list: async () => ({
          ...catalog,
          entries: [
            {
              ...catalog.entries[0]!,
              candidates: [
                {
                  ...candidate,
                  selection: { ...candidate.selection, origin: 'pending' },
                },
              ],
            },
          ],
        }),
        preview: vi.fn(),
      }}
      onResume={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: /Resume as new draft/ });
  expect(
    screen.queryByRole('button', { name: 'Open latest version' }),
  ).toBeNull();
});
