import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import {
  ExportPdfController,
  type ExportPdfPort,
  type PdfCaptureReceipt,
  type PdfExportReceipt,
} from '../../src/application/exportPdf';
import { PublicationPreviewController } from '../../src/application/publicationPreview';
import type { CapturedSnapshot } from '../../src/application/persistenceController';
import type {
  PublicationPreviewPort,
  PublicationResult,
} from '../../src/application/publication';
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
/** Blocking raw content plus its SC004 warning: export must stop for review. */
const REVIEW = 'INT. LAB - DAY\n\n{{raw}} light.\n';
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
  const changed = vi.fn();
  const controller = new ExportPdfController(
    port,
    assessment,
    preview,
    changed,
  );
  const capture = vi.fn(async () => ({ snapshot, receipt }));
  return {
    changed,
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
it('AUDIT-D04 exports a capture with nothing to review straight to the destination picker', async () => {
  const t = await setup();
  t.preview.open();
  const job = deferred<Awaited<ReturnType<ExportPdfPort['render']>>>();
  t.port.render = vi.fn(() => job.promise);
  const exporting = t.controller.start(t.capture);
  await vi.waitFor(() => expect(t.controller.state.phase).toBe('rendering'));
  expect(t.port.select).toHaveBeenCalledOnce();
  // Typing after the protected capture cannot cancel or replace the export.
  t.f.state = t.f.state.apply(t.f.state.tr.insertText('Newer', 1));
  t.preview.invalidate();
  t.preview.accept(await t.f.capture());
  await vi.advanceTimersByTimeAsync(1000);
  expect(t.previewPort.render).not.toHaveBeenCalled();
  job.resolve(
    publicationResult({
      identity: t.f.identity,
      requestId: 1,
      ...t.snapshot,
      profile: 'us-letter-draft-v1',
      fontSet: 'courier-prime-screenplain-0.12.0',
      options: {},
    }),
  );
  await exporting;
  expect(t.controller.state.phase).toBe('succeeded');
  expect(t.controller.state.message).toContain('version 1');
  expect(t.controller.busy).toBe(false);
  expect(t.port.publish).toHaveBeenCalledOnce();
  // A published capture is consumed, not cancelled.
  expect(t.port.cancel).not.toHaveBeenCalled();
  expect(
    t.changed.mock.calls.map(([state]) => (state as { phase: string }).phase),
  ).not.toContain('review');
  // proceed() has nothing to continue once the direct export has finished.
  await t.controller.proceed(true);
  expect(t.port.publish).toHaveBeenCalledOnce();
  t.preview.dispose();
});
it('protects then reviews exact capture before selecting; typing cannot cancel or replace export', async () => {
  const t = await setup(REVIEW);
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
it('AUDIT-D04 summarises omitted notes, sections and advisories without asking for review', async () => {
  const t = await setup(
    '# Act\n\nINT. LAB - DAY\n\nA [[private note]] light.\n\n\n\n\nMore.\n',
  );
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('succeeded');
  expect(t.port.select).toHaveBeenCalledOnce();
  const report = t.controller.state.report!;
  expect(report.issues.map((issue) => issue.severity)).toEqual(['advisory']);
  expect(report.exportAssessment).toMatchObject({
    status: 'verified',
    omissions: { notes: { count: 1 }, sections: { count: 1 } },
  });
  t.preview.dispose();
});
it.each([
  ['structural warning', 'INT. LAB - DAY\n\nAn *unpaired star.\n', 'SC004'],
  ['unclosed note', 'INT. LAB - DAY\n\nA light.\n\n[[never closed\n', 'SC005'],
  [
    'unknown title field',
    'Archive: Extra\n\nINT. LAB - DAY\n\nA light.\n',
    'SC005',
  ],
  ['renderer-dropped text', 'INT. LAB - DAY\n\n#1 DAD mug sits.\n', 'SC005'],
])(
  'still requires informed acknowledgment for %s',
  async (_name, source, code) => {
    const t = await setup(source);
    await t.controller.start(t.capture);
    expect(t.controller.state.phase).toBe('review');
    expect(t.controller.state.report?.issues.map((i) => i.code)).toContain(
      code,
    );
    await t.controller.proceed(false);
    expect(t.port.select).not.toHaveBeenCalled();
    await t.controller.proceed(true);
    expect(t.controller.state.phase).toBe('succeeded');
    t.preview.dispose();
  },
);
it.each(['missing', 'wrong identity', 'missing layout', 'truncated'])(
  'unavailable assessment %s never selects or publishes',
  async (reason) => {
    const t = await setup(
      reason === 'truncated'
        ? Array.from({ length: 1002 }, () => '!A {{raw}} light.\n\n').join('')
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
it.each(
  ['capture', 'assessment', 'picker', 'render'].flatMap((phase) => [
    [phase, 'direct', undefined],
    [phase, 'reviewed', REVIEW],
  ]) as [string, string, string | undefined][],
)(
  'cancellation during %s (%s) writes nothing even after late replies',
  async (phase, _path, source) => {
    const t = await setup(source);
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
      if (source) {
        await start;
        expect(t.controller.state.phase).toBe('review');
        proceed = t.controller.proceed(true);
      }
      await vi.waitFor(() =>
        expect(t.controller.state.phase).toBe(
          phase === 'picker' ? 'selecting' : 'rendering',
        ),
      );
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
  t.port.select = vi.fn(async () => null);
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('cancelled');
  expect(t.port.publish).not.toHaveBeenCalled();
  t.port.select = vi.fn(async () => ({
    token: 'next',
    fileName: 'Draft.pdf',
    replacesExisting: false,
  }));
  t.port.render = vi.fn(async () => {
    throw new Error('glyph-coverage-or-shaping');
  });
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('failed');
  expect(t.port.publish).not.toHaveBeenCalled();
  t.preview.dispose();
});
it('atomic publication is noncancellable and names its captured version', async () => {
  const t = await setup();
  const pending = deferred<PdfExportReceipt>();
  t.port.publish = vi.fn(() => pending.promise);
  const job = t.controller.start(t.capture);
  await vi.waitFor(() => expect(t.controller.state.phase).toBe('publishing'));
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
  const publish = t.port.publish;
  t.port.publish = vi.fn(async (r) => {
    const p = await publish(r);
    return { ...p, result: { ...p.result, version: 999 } };
  });
  await t.controller.start(t.capture);
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
  const t = await setup(REVIEW);
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

// AUDIT-EXPORT-WARNINGS. The renderer says what it left out; anything the
// captured assessment did not tell the author about stops before publication.
// The corpus's `warnings` are checked against the pinned helper itself in
// tests/differential/renderer.test.ts; here the render reply is injected.
const warned = (...features: string[]) =>
  features.map((feature) => ({
    code: 'unsupported-publication:' + feature,
    message: `This profile omits ${feature}; export assessment is required.`,
  }));
function renderWarns(t: Awaited<ReturnType<typeof setup>>, warnings: unknown) {
  const render = t.port.render;
  t.port.render = vi.fn(async (r) => ({
    ...(await render(r)),
    warnings: warnings as PublicationResult['warnings'],
  }));
}
const phases = (t: Awaited<ReturnType<typeof setup>>) =>
  t.changed.mock.calls.map(([state]) => (state as { phase: string }).phase);
it('AUDIT-EXPORT-WARNINGS a renderer warning beside a clean assessment never reaches publication', async () => {
  const t = await setup();
  renderWarns(t, warned('unknown-title-fields'));
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('failed');
  expect(t.controller.state.message).toBe(
    'PDF export needs attention: The renderer reported leaving out unknown title page fields, which the export check did not report. No PDF was written. Editing and Save remain available; no export success is confirmed.',
  );
  expect(t.controller.state.receipt).toBeNull();
  expect(phases(t)).not.toContain('publishing');
  expect(phases(t)).not.toContain('succeeded');
  expect(t.port.publish).not.toHaveBeenCalled();
  // The rendered artifact is discarded and the protected capture retired.
  expect(t.previewPort.cancel).toHaveBeenCalledWith({
    identity: t.f.identity,
    requestId: 1,
  });
  expect(t.port.cancel).toHaveBeenCalledOnce();
  expect(t.controller.busy).toBe(false);
  // A later export recaptures and succeeds once the renderer agrees.
  t.port.render = vi.fn(async (r) =>
    publicationResult({
      ...r,
      ...t.snapshot,
      profile: 'us-letter-draft-v1',
      fontSet: 'courier-prime-screenplain-0.12.0',
      options: {},
    }),
  );
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('succeeded');
  expect(t.capture).toHaveBeenCalledTimes(2);
  t.preview.dispose();
});
it.each([
  ['boneyards', 'boneyard text'],
  ['notes', 'notes'],
  ['sections', 'section headings'],
  ['synopses', 'synopses'],
  ['unknown-title-fields', 'unknown title page fields'],
])(
  'AUDIT-EXPORT-WARNINGS unannounced %s stops a clean capture and is named',
  async (feature, name) => {
    const t = await setup();
    renderWarns(t, warned(feature));
    await t.controller.start(t.capture);
    expect(t.controller.state.phase).toBe('failed');
    expect(t.controller.state.message).toContain(
      `reported leaving out ${name}, which`,
    );
    expect(t.port.publish).not.toHaveBeenCalled();
    expect(t.port.cancel).toHaveBeenCalledOnce();
    t.preview.dispose();
  },
);
const warningCorpus = JSON.parse(
  readFileSync('fixtures/assessment/export-warnings.json', 'utf8'),
) as {
  cases: {
    name: string;
    source: string;
    warnings: string[];
    review: boolean;
    exports: boolean;
  }[];
};
it.each(warningCorpus.cases)(
  'AUDIT-EXPORT-WARNINGS corpus: $name',
  async ({ source, warnings, review, exports }) => {
    const t = await setup(source);
    renderWarns(t, warned(...warnings));
    await t.controller.start(t.capture);
    expect(phases(t).includes('review')).toBe(review);
    if (review) {
      expect(t.controller.state.phase).toBe('review');
      await t.controller.proceed(true);
    }
    expect(t.controller.state.phase).toBe(exports ? 'succeeded' : 'failed');
    expect(t.port.publish).toHaveBeenCalledTimes(exports ? 1 : 0);
    if (!exports) {
      expect(t.controller.state.message).toContain('No PDF was written');
      expect(t.port.cancel).toHaveBeenCalledOnce();
    }
    t.preview.dispose();
  },
);
it('AUDIT-EXPORT-WARNINGS an acknowledged limitation covers only its own kind', async () => {
  const t = await setup('Archive: Extra\n\nINT. LAB - DAY\n\nA light.\n');
  renderWarns(t, warned('notes', 'sections', 'unknown-title-fields'));
  await t.controller.start(t.capture);
  expect(t.controller.state.phase).toBe('review');
  await t.controller.proceed(true);
  expect(t.controller.state.phase).toBe('failed');
  expect(t.controller.state.message).toContain(
    'reported leaving out notes and section headings, which',
  );
  expect(t.controller.state.message).not.toContain('title page');
  expect(t.port.publish).not.toHaveBeenCalled();
  // The reviewed report stays visible beside the failure.
  expect(t.controller.state.report?.issues.map((i) => i.code)).toContain(
    'SC005',
  );
  t.preview.dispose();
});
it.each([
  ['an unknown category', warned('lyrics'), '“lyrics”'],
  ['a code without the prefix', [{ code: 'notes', message: '' }], '“notes”'],
  ['a missing list', undefined, 'could not be compared'],
  ['a list that is not a list', 'notes', 'could not be compared'],
  ['an empty entry', [null], 'could not be compared'],
  ['an entry without a code', [{ message: 'x' }], 'could not be compared'],
  ['a code that is not text', [{ code: 5 }], 'could not be compared'],
])(
  'AUDIT-EXPORT-WARNINGS %s from the renderer is never taken as predicted',
  async (_name, warnings, wording) => {
    // Notes are announced here, so only the unreadable part can stop it.
    const t = await setup('INT. LAB - DAY\n\nA lamp glows.\n\n[[Private]]\n');
    renderWarns(
      t,
      Array.isArray(warnings) ? [...warned('notes'), ...warnings] : warnings,
    );
    await t.controller.start(t.capture);
    expect(t.controller.state.phase).toBe('failed');
    expect(t.controller.state.message).toContain(wording);
    expect(t.controller.state.message).toContain('No PDF was written');
    expect(t.port.publish).not.toHaveBeenCalled();
    expect(t.port.cancel).toHaveBeenCalledOnce();
    t.preview.dispose();
  },
);
it('AUDIT-EXPORT-WARNINGS a mismatching result after cancellation stays cancelled', async () => {
  const t = await setup();
  const job = deferred<Awaited<ReturnType<ExportPdfPort['render']>>>();
  t.port.render = vi.fn(() => job.promise);
  const exporting = t.controller.start(t.capture);
  await vi.waitFor(() => expect(t.controller.state.phase).toBe('rendering'));
  await t.controller.cancel();
  job.resolve({
    ...publicationResult({
      identity: t.f.identity,
      requestId: 1,
      ...t.snapshot,
      profile: 'us-letter-draft-v1',
      fontSet: 'courier-prime-screenplain-0.12.0',
      options: {},
    }),
    warnings: warned('unknown-title-fields'),
  });
  await exporting;
  expect(t.controller.state.phase).toBe('cancelled');
  expect(phases(t)).not.toContain('failed');
  expect(t.port.publish).not.toHaveBeenCalled();
  expect(t.port.cancel).toHaveBeenCalledOnce();
  t.preview.dispose();
});
