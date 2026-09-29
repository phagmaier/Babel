import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SaveStatus } from '../../src/app/SaveStatus';
import type { CadenceStatus } from '../../src/application/saveCadence';

afterEach(cleanup);

function status(overrides: Partial<CadenceStatus>): CadenceStatus {
  return {
    status: 'Saved locally',
    liveVersion: 21,
    journaledVersion: 21,
    fileSavedVersion: 21,
    snapshotAttention: false,
    lastRollingVersion: 21,
    ...overrides,
  };
}

it('renders saved state with exact protection versions', () => {
  render(<SaveStatus status={status({})} />);
  const region = screen.getByRole('status');
  expect(region.textContent).toContain('Saved locally');
  expect(region.textContent).toContain('live version 21');
  expect(region.textContent).toContain('recovery version 21');
  expect(region.textContent).toContain('file-saved version 21');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('renders failure and divergence without claiming protection', () => {
  render(
    <SaveStatus
      status={status({
        status: 'Save failed',
        fileSavedVersion: 20,
      })}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('Save failed');
  render(
    <SaveStatus status={status({ status: 'External change detected' })} />,
  );
  const second = screen.getAllByRole('status')[1]?.textContent ?? '';
  expect(second).toContain('External change detected');
});

it('keeps snapshot attention separate from save protection', () => {
  render(
    <SaveStatus
      status={status({ snapshotAttention: true, lastRollingVersion: null })}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('Saved locally');
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain('Snapshots need attention');
  expect(alert.textContent).toContain('unaffected');
});
