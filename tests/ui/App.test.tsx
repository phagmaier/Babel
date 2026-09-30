import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import type { AppInfoPort } from '../../src/application/appInfo';

afterEach(cleanup);

describe('M0 shell', () => {
  it('shows app info and reports browser-only storage services', async () => {
    const appInfo: AppInfoPort = {
      getAppInfo: async () => ({
        status: 'ready',
        info: { name: 'babel', version: '0.0.1', platform: 'desktop' },
      }),
    };
    render(<App appInfo={appInfo} />);
    expect(
      (await screen.findByText(/native desktop host connected/)).textContent,
    ).toContain('babel 0.0.1');
    expect(
      (
        screen.getByRole('button', {
          name: /New screenplay/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: /Open Fountain/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('never reads native recents in the browser preview', async () => {
    const list = vi.fn();
    render(
      <App
        recents={{
          list,
          open: vi.fn(),
          remove: vi.fn(),
          locate: vi.fn(),
          confirmLocation: vi.fn(),
        }}
      />,
    );
    await screen.findByText('Recents require the native desktop app.');
    expect(list).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: 'New with destination',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('states when native app information is unavailable', async () => {
    const appInfo: AppInfoPort = {
      getAppInfo: async () => ({
        status: 'unavailable',
        reason: 'Browser preview only',
      }),
    };
    render(<App appInfo={appInfo} />);
    expect((await screen.findByRole('status')).textContent).toContain(
      'Browser preview only',
    );
  });
});
