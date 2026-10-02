import { afterEach, expect, it, vi } from 'vitest';
import {
  ExportPdfController,
  type ExportPdfPort,
  type PdfCaptureReceipt,
  type PdfExportReceipt,
} from '../../src/application/exportPdf';
import { PublicationPreviewController } from '../../src/application/publicationPreview';
import type { CapturedSnapshot } from '../../src/application/persistenceController';
import type { PublicationPreviewPort } from '../../src/application/publication';
import type { ExportAssessmentPort } from '../../src/application/exportAssessment';
import { PUBLICATION_ASSESSMENT_IDENTITY } from '../../src/domain/exportAssessment';
import {
  deferred,
  previewFixture,
  publicationResult,
} from '../publicationFixture';
import { nativeExportPdf } from '../../src/infrastructure/nativeExportPdf';
import { invoke } from '@tauri-apps/api/core';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.useRealTimers());
async function setup(text?: string) {
  vi.useFakeTimers();
  const f = await previewFixture();
  const projected = await f.capture();
  const snapshot: CapturedSnapshot = text
    ? {
        ...projected.projection!.snapshot,
        source: [...new TextEncoder().encode(text)],
      }
    : projected.projection!.snapshot;
  const receipt: PdfCaptureReceipt = {
    identity: f.identity,
    captureToken: 'capture',
    version: snapshot.version,
    sourceSha256: snapshot.sourceSha256,
    checkpoint: {
      identity: f.identity,
      version: snapshot.version,
      sourceSha256: snapshot.sourceSha256,
      generation: 1,
      protection: 'recoveryCheckpoint',
    },
  };
  const previewPort: PublicationPreviewPort = {
    render: vi.fn(async (r) => publicationResult(r)),
    read: vi.fn(async () => new TextEncoder().encode('%PDF-1.4')),
    cancel: vi.fn(async () => {}),
  };
  const preview = new PublicationPreviewController(
    previewPort,
    () => ({ identity: f.identity, stamp: f.stamp() }),
    vi.fn(),
  );
  preview.accept(projected);
  const port: ExportPdfPort = {
    prepare: vi.fn(async () => receipt),
    select: vi.fn(async () => ({
      token: 'destination',
      fileName: 'Draft.pdf',
      replacesExisting: false,
    })),
    render: vi.fn(async (r) =>
      publicationResult({
        ...r,
        ...snapshot,
        profile: 'us-letter-draft-v1',
        fontSet: 'courier-prime-screenplain-0.12.0',
        options: {},
      }),
    ),
    publish: vi.fn(async (r) => ({
      publication: {
        fileName: 'Draft.pdf',
        pdfSha256: 'f'.repeat(64),
        byteLength: 100,
        previousFileName: null,
      },
      result: await port.render({
        identity: r.identity,
        captureToken: r.captureToken,
        requestId: r.requestId,
      }),
    })),
    cancel: vi.fn(async () => {}),
  };
  const assessment: ExportAssessmentPort = {
    assess: vi.fn(async (sources) => ({
      identity: PUBLICATION_ASSESSMENT_IDENTITY,
      layout: sources.map(() => null),
    })),
  };
  const controller = new ExportPdfController(
    port,
    assessment,
    preview,
    vi.fn(),
  );
  const capture = vi.fn(async () => ({ snapshot, receipt }));
  return {
    f,
    snapshot,
    receipt,
    port,
    assessment,
    preview,
    previewPort,
    controller,
    capture,
  };
}
it('protects then reviews exact capture before selecting; typing cannot cancel or replace export', async () => {
  const t = await setup();
  t.preview.open();
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('review');
  expect(t.port.select).not.toHaveBeenCalled();
  expect(t.port.publish).not.toHaveBeenCalled();
  const job = deferred<Awaited<ReturnType<ExportPdfPort['render']>>>();
  t.port.render = vi.fn(() => job.promise);
  const exporting = t.controller.proceed(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.state.phase).toBe('rendering');
  t.f.state = t.f.state.apply(t.f.state.tr.insertText('Newer', 1));
  t.preview.invalidate();
  t.preview.accept(await t.f.capture());
  await vi.advanceTimersByTimeAsync(1000);
  expect(t.previewPort.render).not.toHaveBeenCalled();
  expect(t.previewPort.cancel).not.toHaveBeenCalled();
  const result = publicationResult({
    identity: t.f.identity,
    requestId: 1,
    ...t.snapshot,
    profile: 'us-letter-draft-v1',
    fontSet: 'courier-prime-screenplain-0.12.0',
    options: {},
  });
  job.resolve(result);
  await exporting;
  expect(t.controller.state.message).toContain('version 1');
  expect(t.controller.state.phase).toBe('succeeded');
  expect(t.port.publish).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(750);
  expect(t.previewPort.render).toHaveBeenCalledWith(
    expect.objectContaining({ version: 2, requestId: 2 }),
  );
  t.preview.dispose();
});
it('requires informed acknowledgment for omissions and structural warnings', async () => {
  const t = await setup('INT. LAB - DAY\n\nA [[private note]] light.\n');
  await t.controller.start(t.capture);
  expect(
    t.controller.state.report?.issues.some((i) => i.code === 'SC005'),
  ).toBe(true);
  await t.controller.proceed(false);
  expect(t.port.select).not.toHaveBeenCalled();
  await t.controller.proceed(true);
  expect(t.controller.state.phase).toBe('succeeded');
  t.preview.dispose();
});
it.each(['missing', 'wrong identity', 'missing layout', 'truncated'])(
  'unavailable assessment %s never selects or publishes',
  async (reason) => {
    const t = await setup(
      reason === 'truncated'
        ? Array.from(
            { length: 1002 },
            () => '!A [[private note]] light.\n\n',
          ).join('')
        : 'INT. LAB - DAY #1#\n\nA light.\n',
    );
    if (reason === 'missing')
      t.assessment.assess = vi.fn(async () => {
        throw new Error('unavailable');
      });
    if (reason === 'wrong identity')
      t.assessment.assess = vi.fn(async () => ({
        identity: { ...PUBLICATION_ASSESSMENT_IDENTITY, fontSet: 'unknown' },
        layout: [],
      }));
    if (reason === 'missing layout')
      t.assessment.assess = vi.fn(async () => ({
        identity: PUBLICATION_ASSESSMENT_IDENTITY,
        layout: [],
      }));
    await t.controller.start(t.capture);
    expect(t.controller.state.phase).toBe('failed');
    expect(t.port.select).not.toHaveBeenCalled();
    expect(t.port.publish).not.toHaveBeenCalled();
    expect(t.port.cancel).toHaveBeenCalledOnce();
    t.preview.dispose();
  },
);
it.each(['capture', 'assessment', 'picker', 'render'])(
  'cancellation during %s writes nothing even after late replies',
  async (phase) => {
    const t = await setup();
    const wait = deferred<unknown>();
    if (phase === 'capture')
      t.capture = vi.fn(() => wait.promise as ReturnType<typeof t.capture>);
    if (phase === 'assessment')
      t.assessment.assess = vi.fn(
        () => wait.promise as ReturnType<ExportAssessmentPort['assess']>,
      );
    if (phase === 'picker')
      t.port.select = vi.fn(
        () => wait.promise as ReturnType<ExportPdfPort['select']>,
      );
    if (phase === 'render')
      t.port.render = vi.fn(
        () => wait.promise as ReturnType<ExportPdfPort['render']>,
      );
    const start = t.controller.start(t.capture);
    await vi.advanceTimersByTimeAsync(0);
    let proceed: Promise<void> | undefined;
    if (['picker', 'render'].includes(phase)) {
      await start;
      proceed = t.controller.proceed(true);
      await vi.advanceTimersByTimeAsync(0);
    }
    await t.controller.cancel();
    wait.resolve(
      phase === 'capture'
        ? { snapshot: t.snapshot, receipt: t.receipt }
        : phase === 'assessment'
          ? { identity: PUBLICATION_ASSESSMENT_IDENTITY, layout: [] }
          : phase === 'picker'
            ? {
                token: 'destination',
                fileName: 'Draft.pdf',
                replacesExisting: false,
              }
            : publicationResult({
                identity: t.f.identity,
                requestId: 1,
                ...t.snapshot,
                profile: 'us-letter-draft-v1',
                fontSet: 'courier-prime-screenplain-0.12.0',
                options: {},
              }),
    );
    await start;
    await proceed;
    expect(t.port.publish).not.toHaveBeenCalled();
    expect(t.controller.state.phase).toBe('cancelled');
    expect(t.controller.busy).toBe(false);
    expect(t.port.cancel).toHaveBeenCalledOnce();
    t.preview.dispose();
  },
);
it('picker cancellation and renderer glyph refusal leave source and destination untouched', async () => {
  const t = await setup();
  await t.controller.start(t.capture);
  t.port.select = vi.fn(async () => null);
  await t.controller.proceed(true);
  expect(t.controller.state.phase).toBe('cancelled');
  expect(t.port.publish).not.toHaveBeenCalled();
  t.port.select = vi.fn(async () => ({
    token: 'next',
    fileName: 'Draft.pdf',
    replacesExisting: false,
  }));
  await t.controller.start(t.capture);
  t.port.render = vi.fn(async () => {
    throw new Error('glyph-coverage-or-shaping');
  });
  await t.controller.proceed(true);
  expect(t.controller.state.phase).toBe('failed');
  expect(t.port.publish).not.toHaveBeenCalled();
  t.preview.dispose();
});
it('atomic publication is noncancellable and names its captured version', async () => {
  const t = await setup();
  await t.controller.start(t.capture);
  const pending = deferred<PdfExportReceipt>();
  t.port.publish = vi.fn(() => pending.promise);
  const job = t.controller.proceed(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.state.phase).toBe('publishing');
  await t.controller.cancel();
  expect(t.controller.state.phase).toBe('publishing');
  pending.resolve({
    publication: {
      fileName: 'Draft.pdf',
      pdfSha256: 'f'.repeat(64),
      byteLength: 100,
      previousFileName: null,
    },
    result: await t.port.render({
      identity: t.f.identity,
      captureToken: 'capture',
      requestId: 1,
    }),
  });
  await job;
  expect(t.controller.state.phase).toBe('succeeded');
  t.preview.dispose();
});
it('malformed publication receipt never announces success', async () => {
  const t = await setup();
  await t.controller.start(t.capture);
  const publish = t.port.publish;
  t.port.publish = vi.fn(async (r) => {
    const p = await publish(r);
    return { ...p, result: { ...p.result, version: 999 } };
  });
  await t.controller.proceed(true);
  expect(t.controller.state.phase).toBe('failed');
  expect(t.controller.state.receipt).toBeNull();
  t.preview.dispose();
});
it('native adapter sends strict tokens without frontend destination paths', async () => {
  vi.mocked(invoke).mockResolvedValue(null);
  const request = {
    identity: { handle: 'h', documentId: 'd', sessionId: 's' },
    captureToken: 'capture',
  };
  await nativeExportPdf.select(request);
  expect(invoke).toHaveBeenLastCalledWith('select_pdf_destination', {
    request,
  });
  await nativeExportPdf.cancel(request);
  expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { request });
});
it('keeps a cancelled run busy until native authorities are retired before recapture', async () => {
  const t = await setup();
  await t.controller.start(t.capture);
  const retired = deferred<void>();
  t.port.cancel = vi.fn(() => retired.promise);
  const cancelled = t.controller.cancel();
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.busy).toBe(true);
  await t.controller.start(t.capture);
  expect(t.capture).toHaveBeenCalledOnce();
  retired.resolve();
  await cancelled;
  expect(t.controller.busy).toBe(false);
  await t.controller.start(t.capture);
  expect(t.capture).toHaveBeenCalledTimes(2);
  expect(t.controller.state.phase).toBe('review');
  await t.controller.cancel();
  t.preview.dispose();
});
