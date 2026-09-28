import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import type { AppInfoPort } from '../../src/application/appInfo';

afterEach(cleanup);

describe('M0 shell', () => {
  it('shows native app info without enabling unimplemented actions', async () => {
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
