import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExportPdfPanel } from '../../src/app/ExportPdfPanel';
import type {
  ExportPdfController,
  ExportPdfState,
} from '../../src/application/exportPdf';
import { parseFountain } from '../../src/domain/fountainCodec';
import { evaluateScriptCheck } from '../../src/domain/scriptCheck';
import { PUBLICATION_ASSESSMENT_IDENTITY } from '../../src/domain/exportAssessment';
afterEach(cleanup);
const report = evaluateScriptCheck(
  parseFountain(new TextEncoder().encode('!A [[private note]] light.\n')),
  {
    identity: PUBLICATION_ASSESSMENT_IDENTITY,
    version: 7,
    sourceSha256: 'a'.repeat(64),
    layout: [],
  },
);
function fixture() {
  const proceed = vi.fn(),
    cancel = vi.fn();
  const controller = {
    busy: true,
    proceed,
    cancel,
  } as unknown as ExportPdfController;
  const state: ExportPdfState = {
    phase: 'review',
    message: 'Review captured version 7.',
    version: 7,
    report,
    receipt: null,
  };
  return { controller, state, proceed, cancel };
}
it('shows exact version and source-target limitations, requiring explicit unchecked acknowledgment', () => {
  const t = fixture();
  const mounted = render(
    <ExportPdfPanel
      key="7"
      controller={t.controller}
      state={t.state}
      onDismiss={vi.fn()}
    />,
  );
  expect(screen.getByRole('heading').textContent).toContain('version 7');
  expect(screen.getAllByText(/Source bytes/).length).toBeGreaterThan(0);
  const choose = screen.getByRole('button', {
    name: 'Choose PDF destination',
  }) as HTMLButtonElement;
  expect(choose.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(choose.disabled).toBe(false);
  fireEvent.click(choose);
  expect(t.proceed).toHaveBeenCalledWith(true);
  mounted.rerender(
    <ExportPdfPanel
      key="8"
      controller={t.controller}
      state={{ ...t.state, version: 8 }}
      onDismiss={vi.fn()}
    />,
  );
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
    false,
  );
});
it('allows cancellation before writing and explicitly disables it during publication', () => {
  const t = fixture();
  const mounted = render(
    <ExportPdfPanel
      controller={t.controller}
      state={{ ...t.state, phase: 'rendering' }}
      onDismiss={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }));
  expect(t.cancel).toHaveBeenCalledOnce();
  mounted.rerender(
    <ExportPdfPanel
      controller={t.controller}
      state={{
        ...t.state,
        phase: 'publishing',
        message: 'Writing atomically; cancellation is unavailable.',
      }}
      onDismiss={vi.fn()}
    />,
  );
  expect(
    (screen.getByRole('button', { name: 'Cancel export' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByRole('checkbox')).toBeNull();
});
