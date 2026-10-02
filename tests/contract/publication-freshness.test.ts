import { afterEach, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { undo } from 'prosemirror-history';
import { PublicationPreviewController } from '../../src/application/publicationPreview';
import type {
  PublicationPreviewPort,
  PublicationRequest,
  PublicationResult,
} from '../../src/application/publication';
import {
  publicationResult,
  previewFixture,
  deferred,
} from '../publicationFixture';
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers();
  const f = await previewFixture();
  const jobs: {
    request: PublicationRequest;
    pending: ReturnType<typeof deferred<PublicationResult>>;
  }[] = [];
  const reads: ReturnType<typeof deferred<Uint8Array>>[] = [];
  const port: PublicationPreviewPort = {
    render: vi.fn((request) => {
      const pending = deferred<PublicationResult>();
      jobs.push({ request, pending });
      return pending.promise;
    }),
    read: vi.fn(() => {
      const pending = deferred<Uint8Array>();
      reads.push(pending);
      return pending.promise;
    }),
    cancel: vi.fn(async () => {}),
  };
  const changed = vi.fn();
  const controller = new PublicationPreviewController(
    port,
    () => ({ stamp: f.stamp(), identity: f.identity }),
    changed,
  );
  controller.accept(await f.capture());
  return { f, controller, port, jobs, reads, changed };
}
const pdfBytes = new TextEncoder().encode('%PDF-1.4');
it('does no work while closed; debounces exact snapshot and waits for actual display/count confirmation', async () => {
  const t = await setup();
  await vi.advanceTimersByTimeAsync(1000);
  expect(t.port.render).not.toHaveBeenCalled();
  const original = t.f.state;
  t.controller.open();
  await vi.advanceTimersByTimeAsync(749);
  expect(t.port.render).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  const job = t.jobs[0]!;
  job.pending.resolve(publicationResult(job.request));
  await vi.advanceTimersByTimeAsync(0);
  expect(t.port.read).toHaveBeenCalledWith({
    identity: t.f.identity,
    requestId: 1,
    artifact: 'render-1-1',
  });
  t.reads[0]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.state.phase).toBe('updating');
  const artifact = t.controller.state.artifact!;
  t.controller.displayed(artifact, 2);
  expect(t.controller.state.message).toBe('2 pages · preview version 1');
  expect(t.f.state).toBe(original);
  t.controller.dispose();
});
it('immediately invalidates typing and Undo; stale render/read/display replies never replace a newer artifact', async () => {
  const t = await setup();
  t.controller.open();
  await vi.advanceTimersByTimeAsync(750);
  t.jobs[0]!.pending.resolve(publicationResult(t.jobs[0]!.request));
  await vi.advanceTimersByTimeAsync(0);
  t.f.state = t.f.state.apply(t.f.state.tr.insertText('X', 1));
  t.controller.invalidate();
  expect(t.controller.state.phase).toBe('updating');
  t.controller.accept(await t.f.capture());
  await vi.advanceTimersByTimeAsync(750);
  t.jobs[1]!.pending.resolve(publicationResult(t.jobs[1]!.request));
  await vi.advanceTimersByTimeAsync(0);
  t.reads[1]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  const newer = t.controller.state.artifact!;
  t.controller.displayed(newer, 2);
  t.reads[0]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.state.artifact).toBe(newer);
  undo(t.f.state, (tr) => {
    t.f.state = t.f.state.apply(tr);
  });
  t.controller.invalidate();
  t.controller.displayed(newer, 2);
  expect(t.controller.state.phase).toBe('updating');
  expect(t.controller.state.message).toContain('stale');
  t.controller.dispose();
});
it('late render errors and successes after supersede, close or disposal cannot publish', async () => {
  const t = await setup();
  t.controller.open();
  await vi.advanceTimersByTimeAsync(750);
  t.f.state = t.f.state.apply(t.f.state.tr.insertText('X', 1));
  t.controller.invalidate();
  t.controller.accept(await t.f.capture());
  await vi.advanceTimersByTimeAsync(750);
  t.jobs[1]!.pending.resolve(publicationResult(t.jobs[1]!.request));
  await vi.advanceTimersByTimeAsync(0);
  t.reads[0]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  const artifact = t.controller.state.artifact;
  t.jobs[0]!.pending.reject(new Error('late failure'));
  await vi.advanceTimersByTimeAsync(0);
  expect(t.controller.state.artifact).toBe(artifact);
  t.controller.close();
  t.controller.displayed(artifact!, 2);
  expect(t.controller.state.phase).toBe('closed');
  t.controller.open();
  await vi.advanceTimersByTimeAsync(750);
  t.controller.dispose();
  const calls = t.changed.mock.calls.length;
  t.jobs[2]!.pending.resolve(publicationResult(t.jobs[2]!.request));
  await vi.advanceTimersByTimeAsync(0);
  expect(t.changed.mock.calls.length).toBe(calls);
});
it.each(['render', 'read', 'header', 'count', 'viewer', 'capture'] as const)(
  'fails clearly on %s without source mutation',
  async (failure) => {
    const t = await setup();
    const original = t.f.state;
    t.controller.open();
    await vi.advanceTimersByTimeAsync(750);
    if (failure === 'render')
      t.jobs[0]!.pending.reject(new Error('renderer-unavailable'));
    else {
      t.jobs[0]!.pending.resolve(publicationResult(t.jobs[0]!.request));
      await vi.advanceTimersByTimeAsync(0);
      if (failure === 'read') t.reads[0]!.reject(new Error('cancelled'));
      else
        t.reads[0]!.resolve(
          failure === 'header' ? new Uint8Array([1]) : pdfBytes,
        );
    }
    await vi.advanceTimersByTimeAsync(0);
    if (failure === 'count')
      t.controller.displayed(t.controller.state.artifact!, 99);
    if (failure === 'viewer')
      t.controller.displayFailed(t.controller.state.artifact!);
    if (failure === 'capture')
      t.controller.accept({
        phase: 'unavailable',
        projection: null,
        message: 'refused',
      });
    expect(t.controller.state.phase).toBe('failed');
    expect(t.controller.state.message).toContain('Save remain available');
    expect(t.f.state).toBe(original);
    t.controller.dispose();
  },
);
it('selection versions, foreign same-version documents and identity replacement cannot earn freshness', async () => {
  const t = await setup();
  t.controller.open();
  await vi.advanceTimersByTimeAsync(750);
  t.jobs[0]!.pending.resolve(publicationResult(t.jobs[0]!.request));
  await vi.advanceTimersByTimeAsync(0);
  t.reads[0]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  const artifact = t.controller.state.artifact!;
  t.f.state = t.f.state.apply(
    t.f.state.tr.setSelection(TextSelection.create(t.f.state.doc, 2)),
  );
  t.controller.invalidate();
  t.controller.displayed(artifact, 2);
  expect(t.controller.state.phase).toBe('updating');
  t.f.identity.sessionId = 'other';
  t.controller.displayed(artifact, 2);
  expect(t.controller.state.phase).toBe('updating');
  t.controller.dispose();
});

it('coalesces repeated captures and refuses cancelled display callbacks during same-version Refresh', async () => {
  const t = await setup();
  t.controller.open();
  await vi.advanceTimersByTimeAsync(750);
  t.controller.accept(await t.f.capture());
  await vi.advanceTimersByTimeAsync(750);
  expect(t.jobs).toHaveLength(1);
  t.jobs[0]!.pending.resolve(publicationResult(t.jobs[0]!.request));
  await vi.advanceTimersByTimeAsync(0);
  t.reads[0]!.resolve(pdfBytes);
  await vi.advanceTimersByTimeAsync(0);
  const artifact = t.controller.state.artifact!;
  t.controller.displayed(artifact, 2);
  t.controller.refresh();
  t.controller.displayed(artifact, 2);
  t.controller.displayFailed(artifact);
  expect(t.controller.state.phase).toBe('updating');
  await vi.advanceTimersByTimeAsync(750);
  expect(t.jobs).toHaveLength(2);
  t.controller.dispose();
});

it('opening or retrying an already uncapturable draft fails clearly without native work', async () => {
  const t = await setup();
  t.controller.accept({
    phase: 'unavailable',
    projection: null,
    message: 'refused',
  });
  t.controller.open();
  expect(t.controller.state.phase).toBe('failed');
  t.controller.refresh();
  expect(t.controller.state.phase).toBe('failed');
  await vi.advanceTimersByTimeAsync(1000);
  expect(t.port.render).not.toHaveBeenCalled();
  t.controller.dispose();
});
