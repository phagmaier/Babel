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
const check = (source: string) =>
  evaluateScriptCheck(parseFountain(new TextEncoder().encode(source)), {
    identity: PUBLICATION_ASSESSMENT_IDENTITY,
    version: 7,
    sourceSha256: 'a'.repeat(64),
    layout: [],
  });
// One gated raw line beside omissions that only need the summary.
const report = check('# Act\n\n!A [[private note]] light.\n\n{{raw}}\n');
const SUMMARY =
  'Not printed by this profile: 1 note (1 line), 1 section heading.';
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
  // Omitted elements are stated once and are not listed as issues to accept.
  expect(screen.getByText(SUMMARY)).toBeTruthy();
  expect(screen.queryByText(/omits note content/)).toBeNull();
  expect(screen.queryByText(/omits section content/)).toBeNull();
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
it('AUDIT-D04 shows the omission summary without review controls when export goes straight to the picker', () => {
  const t = fixture();
  render(
    <ExportPdfPanel
      controller={t.controller}
      state={{
        ...t.state,
        phase: 'selecting',
        message: 'Choose a destination for version 7…',
        report: check('# Act\n\n!A [[private note]] light.\n'),
      }}
      onDismiss={vi.fn()}
    />,
  );
  expect(screen.getByText(SUMMARY)).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Choose PDF destination' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Cancel export' })).toBeTruthy();
});
it('AUDIT-EXPORT-WARNINGS states a stopped export in the status line with no way to accept it', () => {
  const t = fixture();
  const message =
    'PDF export needs attention: The renderer reported leaving out notes and unknown title page fields, which the export check did not report. No PDF was written. Editing and Save remain available; no export success is confirmed.';
  render(
    <ExportPdfPanel
      controller={{ ...t.controller, busy: false } as ExportPdfController}
      state={{ ...t.state, phase: 'failed', message }}
      onDismiss={vi.fn()}
    />,
  );
  expect(screen.getByRole('status').textContent).toBe(message);
  // What the check did report stays beside it; nothing offers to proceed.
  expect(screen.getByText(SUMMARY)).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Choose PDF destination' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancel export' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Dismiss export status' }),
  ).toBeTruthy();
});
