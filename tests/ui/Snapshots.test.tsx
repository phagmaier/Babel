import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnapshotPanel } from '../../src/app/SnapshotPanel';
import type {
  SnapshotPort,
  SnapshotCatalog,
  SnapshotEntry,
  CopyDestination,
} from '../../src/application/snapshots';
import {
  identity,
  fingerprint,
  A,
  B,
  receiptFor,
} from '../contract/persistence-fixtures';
const current = {
  identity,
  version: 21,
  source: [97],
  sourceSha256: A,
  expectedFingerprint: fingerprint(),
  draftMetadata: {},
};
const entry: SnapshotEntry = {
  selection: {
    snapshotId: '44444444-4444-4444-8444-444444444444',
    recordSha256: A,
  },
  record: {
    schemaVersion: 1,
    snapshotId: '44444444-4444-4444-8444-444444444444',
    documentId: identity.documentId,
    sessionId: identity.sessionId,
    version: 1,
    sourceSha256: B,
    byteLength: 1,
    createdSeconds: 1,
    kind: 'named',
    name: '<img src=x onerror=alert(1)>',
  },
};
const catalog: SnapshotCatalog = {
  entries: [entry],
  sourceBytes: 1,
  needsAttention: false,
  unresolvedArtifacts: 0,
  orphanBlobs: 0,
  atLimit: false,
};
const destination: CopyDestination = {
  token: 'opaque-native',
  storageRelation: 'sameFilesystem',
};
function port(overrides: Partial<SnapshotPort> = {}): SnapshotPort {
  return {
    list: vi.fn().mockResolvedValue(catalog),
    read: vi.fn(),
    create: vi.fn().mockResolvedValue({
      ...entry,
      record: {
        ...entry.record,
        version: 21,
        sourceSha256: A,
        name: 'Named',
      },
    }),
    prune: vi.fn().mockResolvedValue(catalog),
    restore: vi.fn().mockResolvedValue(receiptFor(22, true)),
    copy: vi.fn().mockResolvedValue({
      identity,
      version: 21,
      sourceSha256: A,
      byteLength: 1,
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    }),
    ...overrides,
  };
}
afterEach(cleanup);
describe('snapshot review with injected ports', () => {
  it('renders names as text and verifies named/copy receipts with distinct status', async () => {
    const p = port();
    render(
      <SnapshotPanel
        port={p}
        current={current}
        destination={destination}
        onRestored={vi.fn()}
      />,
    );
    await screen.findByText(/<img src=x/);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/same filesystem/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Snapshot name'), {
      target: { value: 'Named' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Keep named snapshot' }),
    );
    await screen.findByText('Named snapshot protected for version 21.');
    expect(p.create).toHaveBeenCalledWith({
      checkpoint: current,
      kind: 'named',
      name: 'Named',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save copy to selected destination' }),
    );
    await screen.findByText(/Copy verified for version 21/);
    expect(p.copy).toHaveBeenCalledWith({
      checkpoint: current,
      destinationToken: 'opaque-native',
    });
  });
  it('PILOT-2026-10-06 lists versions newest first with the time each was kept', async () => {
    const at = (id: string, seconds: number, name: string): SnapshotEntry => ({
      selection: { snapshotId: id, recordSha256: A },
      record: {
        ...entry.record,
        snapshotId: id,
        createdSeconds: seconds,
        name,
      },
    });
    const older = at(
      '55555555-5555-4555-8555-555555555555',
      1_790_000_000,
      'Older',
    );
    const newer = at(
      '66666666-6666-4666-8666-666666666666',
      1_790_003_600,
      'Newer',
    );
    render(
      <SnapshotPanel
        port={port({
          list: vi
            .fn()
            .mockResolvedValue({ ...catalog, entries: [older, newer] }),
        })}
        current={current}
        destination={destination}
        onRestored={vi.fn()}
      />,
    );
    await screen.findByText(/Newer/);
    const items = [...document.querySelectorAll('li')].filter((li) =>
      li.querySelector('time'),
    );
    expect(items.map((li) => li.textContent?.split(' ·')[0])).toEqual([
      'Newer',
      'Older',
    ]);
    expect(items.map((li) => li.querySelector('time')!.dateTime)).toEqual([
      new Date(1_790_003_600_000).toISOString(),
      new Date(1_790_000_000_000).toISOString(),
    ]);
  });
  it('requires explicit destination and blocks retention on interrupted material', async () => {
    const p = port({
      list: vi
        .fn()
        .mockResolvedValue({ ...catalog, needsAttention: true, atLimit: true }),
    });
    render(<SnapshotPanel port={p} current={current} onRestored={vi.fn()} />);
    await screen.findByText(/Interrupted or damaged/);
    expect(
      (
        screen.getByRole('button', {
          name: 'Apply retention',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Save copy to selected destination',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(/Protected versions will not be removed/),
    ).toBeTruthy();
  });
  it('validates a new restore receipt before publishing to the owner', async () => {
    const restored = vi.fn();
    const p = port();
    render(<SnapshotPanel port={p} current={current} onRestored={restored} />);
    await screen.findByText(/<img src=x/);
    const button = screen.getByRole('button', {
      name: 'Restore previous version',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('New restore version'), {
      target: { value: '22' },
    });
    fireEvent.click(button);
    await screen.findByText(/Restored as new version 22/);
    // M3-12 re-anchors adoption: the owner also receives the entry selection.
    expect(restored).toHaveBeenCalledWith(
      receiptFor(22, true),
      entry.selection,
    );
  });
  it('rejects mismatched copy and restore receipts with fixed text', async () => {
    const restored = vi.fn();
    const p = port({
      restore: vi.fn().mockResolvedValue(receiptFor(21, true)),
      copy: vi.fn().mockRejectedValue(new Error('SECRET transport /path')),
    });
    render(
      <SnapshotPanel
        port={p}
        current={current}
        destination={destination}
        onRestored={restored}
      />,
    );
    await screen.findByText(/<img src=x/);
    fireEvent.change(screen.getByLabelText('New restore version'), {
      target: { value: '22' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore previous version' }),
    );
    await screen.findByText(/Protection failed or its result/);
    expect(restored).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save copy to selected destination' }),
    );
    await waitFor(() => expect(p.copy).toHaveBeenCalled());
    expect(document.body.textContent).not.toContain('SECRET');
  });
  it('ignores an old restore completion after document replacement', async () => {
    let complete!: (r: ReturnType<typeof receiptFor>) => void;
    const restored = vi.fn();
    const p = port({
      restore: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      ),
    });
    const view = render(
      <SnapshotPanel port={p} current={current} onRestored={restored} />,
    );
    await screen.findByText(/<img src=x/);
    fireEvent.change(screen.getByLabelText('New restore version'), {
      target: { value: '22' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore previous version' }),
    );
    view.rerender(
      <SnapshotPanel
        port={p}
        current={{
          ...current,
          identity: {
            ...identity,
            sessionId: '55555555-5555-4555-8555-555555555555',
          },
        }}
        onRestored={restored}
      />,
    );
    await act(async () => complete(receiptFor(22, true)));
    expect(restored).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Restored as new version');
  });
});
