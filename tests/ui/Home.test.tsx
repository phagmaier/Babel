import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../../src/app/Home';
import type {
  RecentProjectsPort,
  LocateSelection,
} from '../../src/application/recentProjects';
import { unavailableRecovery } from '../../src/application/startupRecovery';

const entry = {
  entryId: 'recent-1',
  documentId: 'draft-1',
  kind: 'loose' as const,
  fileName: '<story>.fountain',
  lastKnownModifiedSeconds: 1,
  lastKnownModifiedNanos: 0,
  availability: 'missing' as const,
};
const selection: LocateSelection = {
  entryId: entry.entryId,
  selectionToken: 'token',
  fileName: 'moved.fountain',
  sameManagedIdentity: false,
  contentMatchesLastKnown: true,
  canLinkMoved: true,
};
function port(): RecentProjectsPort {
  return {
    list: vi.fn(async () => ({ entries: [entry], health: 'ready' as const })),
    remove: vi.fn(async () => {}),
    locate: vi.fn(async () => selection),
    open: vi.fn(),
    confirmLocation: vi.fn(),
  };
}
function home(recents = port(), onOpen = vi.fn()) {
  return {
    recents,
    onOpen,
    ...render(
      <Home
        native
        result={null}
        recents={recents}
        recovery={unavailableRecovery}
        onOpen={onOpen}
      />,
    ),
  };
}
afterEach(cleanup);
describe('M4-02 Home (injected native ports)', () => {
  it('keeps New/Open usable while metadata is pending and focuses New', async () => {
    const recents = port();
    recents.list = () => new Promise(() => {});
    const { onOpen } = home(recents);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'New screenplay' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'New with destination' }),
    );
    expect(onOpen).toHaveBeenCalledWith({ kind: 'new', destination: true });
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(onOpen).toHaveBeenCalledWith({ kind: 'picked' });
  });
  it('renders literal filename, missing state and explicit link/different/cancel choices', async () => {
    const { recents, onOpen } = home();
    await screen.findByText(entry.fileName);
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
      '1970-01-01T00:00:01.000Z',
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Open ' + entry.fileName,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Locate ' + entry.fileName }),
    );
    await screen.findByText(/Confirm selected file/);
    expect(screen.getByText(/Matching bytes alone/)).toBeTruthy();
    expect(recents.confirmLocation).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Link moved screenplay' }),
    );
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'located',
      selection,
      choice: 'linkMoved',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Open as different screenplay' }),
    );
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'located',
      selection,
      choice: 'openDifferent',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel linking' }));
    expect(
      screen.queryByRole('button', { name: 'Link moved screenplay' }),
    ).toBeNull();
  });
  it('disables unsafe linking and makes picker cancellation truthful', async () => {
    const recents = port();
    recents.locate = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...selection,
        canLinkMoved: false,
        contentMatchesLastKnown: false,
      });
    home(recents);
    await screen.findByText(entry.fileName);
    fireEvent.click(
      screen.getByRole('button', { name: 'Locate ' + entry.fileName }),
    );
    await screen.findByText(/Locate cancelled/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Locate ' + entry.fileName }),
    );
    await screen.findByText(/cannot safely be linked/);
    expect(
      (
        screen.getByRole('button', {
          name: 'Link moved screenplay',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Open as different screenplay',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it('removes only metadata and explains retention', async () => {
    const { recents } = home();
    await screen.findByText(entry.fileName);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove ' + entry.fileName + ' from Recents',
      }),
    );
    await screen.findByText(/Removed from Recents/);
    expect(recents.remove).toHaveBeenCalledWith(entry.entryId);
    expect(screen.queryByText(entry.fileName)).toBeNull();
    expect(recents.open).not.toHaveBeenCalled();
  });
  it('isolates registry failures and allows a refresh retry', async () => {
    const recents = port();
    recents.list = vi
      .fn()
      .mockRejectedValueOnce(new Error('/private/path'))
      .mockResolvedValue({ entries: [entry], health: 'needsAttention' });
    home(recents);
    await screen.findByText(/Recents could not be read/);
    expect(screen.queryByText('/private/path')).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Open Fountain',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Recents' }));
    await screen.findByText(/Recent metadata needs attention/);
  });
  it('blocks competing entry actions during locate and ignores its late result after unmount', async () => {
    const recents = port();
    let finish!: (value: LocateSelection) => void;
    recents.locate = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const { onOpen, unmount } = home(recents);
    await screen.findByText(entry.fileName);
    fireEvent.click(
      screen.getByRole('button', { name: 'Locate ' + entry.fileName }),
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'New screenplay',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    unmount();
    finish(selection);
    await waitFor(() => expect(recents.confirmLocation).not.toHaveBeenCalled());
  });
  it('rejects a mismatched locate entry and retains failed removals', async () => {
    const recents = port();
    recents.locate = async () => ({ ...selection, entryId: 'wrong' });
    recents.remove = async () => {
      throw { code: 'recentNeedsAttention' };
    };
    home(recents);
    await screen.findByText(entry.fileName);
    fireEvent.click(
      screen.getByRole('button', { name: 'Locate ' + entry.fileName }),
    );
    await screen.findByText(/could not be selected safely/);
    expect(
      screen.queryByRole('button', { name: 'Link moved screenplay' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove ' + entry.fileName + ' from Recents',
      }),
    );
    await screen.findByText(/Removal could not be confirmed/);
    expect(screen.getByText(entry.fileName)).toBeTruthy();
  });
  it('ignores an older metadata read after the port changes and displays entry cancellation', async () => {
    let finish!: (value: {
      entries: (typeof entry)[];
      health: 'ready';
    }) => void;
    const old = port();
    old.list = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const { rerender, onOpen } = home(old);
    const fresh = port();
    fresh.list = async () => ({ entries: [], health: 'ready' });
    rerender(
      <Home
        native
        result={null}
        message="Open cancelled. Files unchanged."
        recents={fresh}
        recovery={unavailableRecovery}
        onOpen={onOpen}
      />,
    );
    await screen.findByText(/No recent screenplays yet/);
    expect(screen.getByText('Open cancelled. Files unchanged.')).toBeTruthy();
    finish({ entries: [entry], health: 'ready' });
    await waitFor(() => expect(screen.queryByText(entry.fileName)).toBeNull());
  });
});
