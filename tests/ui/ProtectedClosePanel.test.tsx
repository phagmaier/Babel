import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProtectedClosePanel } from '../../src/app/ProtectedClosePanel';
import type {
  CloseAssessment,
  ClosePhase,
  ProtectedClose,
} from '../../src/application/protectedClose';

afterEach(cleanup);
function close(phase: 'editing' | 'attention' = 'attention') {
  let currentPhase: ClosePhase = phase;
  const state: CloseAssessment = {
    get phase() {
      return currentPhase;
    },
    liveVersion: 1,
    sourceProtected: false,
    recoveryProtected: false,
    onlyInMemory: true,
    message: 'Close stopped. Newer changes exist only in memory.',
  };
  return {
    assessment: state,
    subscribe: vi.fn((listener: (assessment: CloseAssessment) => void) => {
      listener(state);
      return () => undefined;
    }),
    retry: vi.fn(async () => {
      throw new Error('disk full');
    }),
    saveEmergencyCopy: vi.fn(async () => {
      currentPhase = 'closed';
    }),
    acceptRisk: vi.fn(async (accepted: boolean) => {
      if (accepted) currentPhase = 'closed';
    }),
  } as unknown as ProtectedClose;
}
it('shows persistent in-memory risk and gates explicit risk close behind a checkbox', async () => {
  const policy = close();
  const onClosed = vi.fn();
  render(<ProtectedClosePanel close={policy} onClosed={onClosed} />);
  expect(screen.getByRole('alert').textContent).toMatch(/only in memory/);
  const risk = screen.getByRole('button', { name: 'Close with this risk' });
  expect((risk as HTMLButtonElement).disabled).toBe(true);
  expect(
    (
      screen.getByRole('button', {
        name: 'Save Emergency Copy and close',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry save and close' }));
  await waitFor(() => expect(policy.retry).toHaveBeenCalledOnce());
  expect(onClosed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(risk);
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
  expect(policy.acceptRisk).toHaveBeenCalledWith(
    true,
    policy.assessment.liveVersion,
  );
});

it('uses only a native-selected destination token for an emergency copy', async () => {
  const policy = close();
  const onClosed = vi.fn();
  render(
    <ProtectedClosePanel
      close={policy}
      destination={{
        token: 'opaque-native',
        storageRelation: 'sameFilesystem',
      }}
      onClosed={onClosed}
    />,
  );
  expect(
    screen.getByText(/does not protect against losing that backing disk/),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save Emergency Copy and close' }),
  );
  await waitFor(() =>
    expect(policy.saveEmergencyCopy).toHaveBeenCalledWith('opaque-native'),
  );
  expect(onClosed).toHaveBeenCalledOnce();
});

it('requires a fresh risk choice for a new document session', () => {
  const first = close();
  const second = close();
  const view = render(<ProtectedClosePanel close={first} onClosed={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  view.rerender(<ProtectedClosePanel close={second} onClosed={vi.fn()} />);
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
    false,
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Close with this risk',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

it('invalidates a checked close risk when the live protection status changes', () => {
  const policy = close();
  const view = render(
    <ProtectedClosePanel
      close={policy}
      statusToken="1:unsaved"
      onClosed={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('checkbox'));
  expect(
    (
      screen.getByRole('button', {
        name: 'Close with this risk',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  view.rerender(
    <ProtectedClosePanel
      close={policy}
      statusToken="2:pending"
      onClosed={vi.fn()}
    />,
  );
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
    false,
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Close with this risk',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
