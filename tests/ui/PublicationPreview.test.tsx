import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  PublicationPreview,
  type PdfDocumentView,
  type PdfViewerPort,
} from '../../src/app/PublicationPreview';
import type {
  PreviewArtifact,
  PublicationPreviewController,
  PublicationPreviewState,
} from '../../src/application/publicationPreview';
import { publicationResult, deferred } from '../publicationFixture';
import {
  PUBLICATION_PROFILE,
  PUBLICATION_FONT_SET,
} from '../../src/application/publication';
import { createEditorState } from '../../src/editor/state';
afterEach(cleanup);
function setup() {
  const bytes = new TextEncoder().encode('%PDF-1.4');
  const result = publicationResult({
    identity: { handle: 'h', documentId: 'd', sessionId: 's' },
    requestId: 1,
    version: 4,
    source: [65],
    sourceSha256: 'a'.repeat(64),
    profile: PUBLICATION_PROFILE,
    fontSet: PUBLICATION_FONT_SET,
    options: {},
  });
  const artifact: PreviewArtifact = {
    result,
    bytes,
    stamp: {
      doc: createEditorState(new Uint8Array()).doc,
      session: {},
      version: 4,
    },
  };
  const state: PublicationPreviewState = {
    enabled: true,
    phase: 'updating',
    message: 'Updating',
    artifact,
  };
  const controller = {
    displayed: vi.fn(),
    displayFailed: vi.fn(),
    refresh: vi.fn(),
  } as unknown as PublicationPreviewController;
  const pdf: PdfDocumentView = {
    pages: 2,
    render: vi.fn(async (page, _zoom, host) => {
      host.textContent = `Canvas page ${page}`;
      return `Printed page ${page} text`;
    }),
    close: vi.fn(),
  };
  const viewer: PdfViewerPort = { load: vi.fn(async () => pdf) };
  return { state, controller, pdf, viewer, artifact };
}
it('focuses close, displays one page, exposes read-only text, independent zoom and keyboard page controls', async () => {
  const t = setup(),
    close = vi.fn();
  render(<PublicationPreview {...t} onClose={close} />);
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Close PDF preview' }),
  );
  expect(
    screen
      .getByRole('button', { name: 'Refresh PDF preview' })
      .hasAttribute('disabled'),
  ).toBe(true);
  await waitFor(() =>
    expect(t.controller.displayed).toHaveBeenCalledWith(t.artifact, 2),
  );
  expect(screen.getByText('Printed page 1 text')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next PDF page' }));
  await screen.findByText('Printed page 2 text');
  expect(
    screen
      .getByRole('button', { name: 'Next PDF page' })
      .hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: 'PDF zoom' }), {
    target: { value: '1.5' },
  });
  await waitFor(() =>
    expect(t.pdf.render).toHaveBeenLastCalledWith(
      2,
      1.5,
      expect.any(HTMLElement),
      expect.any(AbortSignal),
    ),
  );
  expect(t.viewer.load).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(
    screen.getByRole('region', { name: 'Read-only PDF preview' }),
    { key: 'Escape' },
  );
  expect(close).toHaveBeenCalledOnce();
});
it('destroys loading and display resources on replacement and unmount; late load cannot show pages', async () => {
  const t = setup(),
    pending = deferred<PdfDocumentView>();
  t.viewer.load = vi.fn(() => pending.promise);
  const mounted = render(<PublicationPreview {...t} onClose={vi.fn()} />);
  const signal = vi.mocked(t.viewer.load).mock.calls[0]![1];
  mounted.unmount();
  expect(signal.aborted).toBe(true);
  pending.resolve(t.pdf);
  await waitFor(() => expect(t.pdf.close).toHaveBeenCalled());
  expect(t.pdf.render).not.toHaveBeenCalled();
});
it.each(['load', 'count', 'render'] as const)(
  'shows viewer %s failure and never confirms a fresh display',
  async (failure) => {
    const t = setup();
    if (failure === 'load')
      t.viewer.load = vi.fn(async () => {
        throw new Error('worker unavailable');
      });
    if (failure === 'count')
      t.viewer.load = vi.fn(async () => ({ ...t.pdf, pages: 3 }));
    if (failure === 'render')
      t.pdf.render = vi.fn(async () => {
        throw new Error('render');
      });
    render(<PublicationPreview {...t} onClose={vi.fn()} />);
    await screen.findByRole('alert');
    if (failure === 'count')
      expect(t.controller.displayed).toHaveBeenCalledWith(t.artifact, 3);
    else expect(t.controller.displayFailed).toHaveBeenCalledWith(t.artifact);
    expect(
      vi
        .mocked(t.controller.displayed)
        .mock.calls.some((call) => call[1] === 2),
    ).toBe(false);
  },
);
it('labels retained stale pages and renderer limitations without claiming export success', async () => {
  const t = setup();
  const artifact = {
    ...t.artifact,
    result: {
      ...t.artifact.result,
      warnings: [{ code: 'omission', message: 'Notes omitted.' }],
    },
  };
  render(
    <PublicationPreview
      {...t}
      state={{
        ...t.state,
        artifact,
        message: 'Updating · earlier preview is stale',
      }}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText(/preview is not current/)).toBeTruthy();
  expect(screen.getByRole('note').textContent).toContain('Notes omitted.');
  await screen.findByText('Printed page 1 text');
});
