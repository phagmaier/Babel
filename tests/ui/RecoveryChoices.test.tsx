import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryChoicePanel } from '../../src/app/RecoveryChoicePanel';
import type {
  RecoveryChoicesPort,
  RecoveryComparison,
} from '../../src/application/recoveryChoices';

const identity = {
  handle: '11111111-1111-4111-8111-111111111111',
  documentId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
};
const selection = {
  documentId: identity.documentId,
  origin: 'current' as const,
  recordSha256: 'a'.repeat(64),
};
const fingerprint = {
  device: '1',
  inode: '2',
  byteLength: 8,
  sha256: 'b'.repeat(64),
  modifiedSeconds: 1,
  modifiedNanos: 0,
  changedSeconds: 1,
  changedNanos: 0,
  mode: 0o100600,
  owner: 1000,
  links: 1,
};
const comparison: RecoveryComparison = {
  identity,
  selection,
  recovery: {
    selection,
    sessionId: identity.sessionId,
    version: 21,
    generation: 2,
    sourceSha256: 'c'.repeat(64),
    byteLength: 8,
    encoding: 'utf8' as const,
  },
  source: {
    status: 'current' as const,
    fingerprint,
    sourceSha256: 'd'.repeat(64),
    byteLength: 8,
    encoding: 'utf8' as const,
  },
  identical: false,
  externalDivergence: false,
  transaction: 'noTransaction' as const,
};

function port(
  overrides: Partial<RecoveryChoicesPort> = {},
): RecoveryChoicesPort {
  return {
    compare: vi.fn(async () => structuredClone(comparison)),
    recover: vi.fn(),
    keep: vi.fn(),
    copy: vi.fn(),
    resolve: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('explicit recovery choices', () => {
  it('retains emergency copying for read-only malformed or missing-source review', async () => {
    const copy = vi.fn(async () => ({
      identity,
      version: 21,
      fileName: 'raw-copy.fountain',
      fingerprint,
      sourceSha256: comparison.recovery.sourceSha256,
      byteLength: 8,
    }));
    const stub = port({
      compare: async () => ({
        ...structuredClone(comparison),
        recovery: { ...comparison.recovery, encoding: 'unsupported' },
        source: {
          ...comparison.source,
          status: 'missing',
          fingerprint: null,
          sourceSha256: null,
        },
        transaction: 'needsAttention',
      }),
      copy,
    });
    render(
      <RecoveryChoicePanel
        port={stub}
        identity={identity}
        selection={selection}
        expectedFingerprint={fingerprint}
        readOnly
      />,
    );
    await screen.findByText(/source file is missing/);
    expect(
      screen
        .getByRole('button', { name: 'Restore recovered draft' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Keep saved file' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Resolve Interrupted Save' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Recovered Copy' }),
    );
    await screen.findByText(/Recovered copy saved as raw-copy.fountain/);
    expect(copy).toHaveBeenCalledExactlyOnceWith({
      identity,
      selection,
      expectedFingerprint: fingerprint,
    });
  });
  it.each(['confirmedRecordDiverged', 'diverged'] as const)(
    'distinguishes reviewed confirmed divergence from unresolved %s',
    async (transaction) => {
      const keep = vi.fn(async () => ({
        ...structuredClone(comparison),
        transaction,
      }));
      render(
        <RecoveryChoicePanel
          port={port({
            compare: async () => ({
              ...structuredClone(comparison),
              transaction,
            }),
            keep,
          })}
          identity={identity}
          selection={selection}
          expectedFingerprint={fingerprint}
        />,
      );
      const button = await screen.findByRole('button', {
        name: 'Keep saved file',
      });
      await screen.findByText(/Which draft do you want to use/);
      await waitFor(() =>
        expect(button.hasAttribute('disabled')).toBe(
          transaction === 'diverged',
        ),
      );
      expect(
        screen
          .getByRole('button', { name: 'Restore recovered draft' })
          .hasAttribute('disabled'),
      ).toBe(transaction === 'diverged');
      if (transaction === 'confirmedRecordDiverged') {
        fireEvent.click(button);
        await screen.findByText(/The current file was kept\./);
        expect(keep).toHaveBeenCalledOnce();
        expect(
          screen.queryByRole('button', { name: 'Resolve Interrupted Save' }),
        ).toBeNull();
      }
    },
  );

  it('shows both generations and completes an explicit recovery without picking a timestamp winner', async () => {
    const receipt = {
      identity,
      version: 22,
      sourceSha256: 'c'.repeat(64),
      fingerprint,
      recovery: {
        identity,
        version: 22,
        sourceSha256: 'c'.repeat(64),
        generation: 3,
        protection: 'recoveryCheckpoint' as const,
      },
      protection: 'sourceFile' as const,
    };
    const recover = vi.fn(async () => receipt);
    const stub = port({ recover });
    render(
      <RecoveryChoicePanel
        port={stub}
        identity={identity}
        selection={selection}
        expectedFingerprint={fingerprint}
      />,
    );
    await screen.findByText(/Recovery version 21, generation 2/);
    expect(
      screen.getByText(`Recovery SHA-256: ${'c'.repeat(64)}`),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore recovered draft' }),
    );
    await waitFor(() =>
      expect(recover).toHaveBeenCalledWith({
        identity,
        selection,
        newVersion: 22,
        expectedFingerprint: fingerprint,
      }),
    );
    await screen.findByText(/Recovered as current, version 22/);
  });

  it('keeps the current file and saves an emergency copy with fixed wording', async () => {
    const keep = vi.fn(async () => structuredClone(comparison));
    const copy = vi.fn(async () => ({
      identity,
      version: 21,
      fileName: 'story.fountain.recovered-x.fountain',
      fingerprint,
      sourceSha256: 'c'.repeat(64),
      byteLength: 8,
    }));
    const stub = port({ keep, copy });
    render(
      <RecoveryChoicePanel
        port={stub}
        identity={identity}
        selection={selection}
        expectedFingerprint={fingerprint}
      />,
    );
    await screen.findByText(/Recovery version 21, generation 2/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep saved file' }));
    await screen.findByText(/The current file was kept/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Recovered Copy' }),
    );
    await screen.findByText(
      /Recovered copy saved as story\.fountain\.recovered-x\.fountain/,
    );
  });

  it('reports choice failures with fixed wording and rejects a substituted generation', async () => {
    const recover = vi.fn(async () => {
      throw { code: 'sourceChanged', action: 'reopenOrSaveCopy' };
    });
    const substituted = structuredClone(comparison);
    substituted.selection = {
      ...selection,
      recordSha256: 'f'.repeat(64),
    };
    const compare = vi.fn(async () => substituted);
    const stub = port({ compare, recover });
    render(
      <RecoveryChoicePanel
        port={stub}
        identity={identity}
        selection={selection}
        expectedFingerprint={fingerprint}
      />,
    );
    await screen.findByText(/Source comparison unavailable/);
    expect(recover).not.toHaveBeenCalled();
  });

  it('blocks adoption on external divergence and explains a stuck transaction', async () => {
    const diverged = structuredClone(comparison);
    diverged.externalDivergence = true;
    diverged.transaction = 'installedCandidateUnconfirmed';
    const resolved = {
      identity,
      observation: 'installedCandidateUnconfirmed' as const,
      completed: null,
      previousPreserved: true,
    };
    const resolve = vi.fn(async () => resolved);
    const stub = port({ compare: vi.fn(async () => diverged), resolve });
    render(
      <RecoveryChoicePanel
        port={stub}
        identity={identity}
        selection={selection}
        expectedFingerprint={fingerprint}
      />,
    );
    await screen.findByText(/changed outside this session/);
    expect(
      screen.getByRole('button', {
        name: 'Restore recovered draft',
      }) as HTMLButtonElement,
    ).toHaveProperty('disabled', true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Resolve Interrupted Save' }),
    );
    await screen.findByText(/No interrupted save needed completion/);
    expect(resolve).toHaveBeenCalledWith(identity);
  });
});
