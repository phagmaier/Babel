import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import {
  PublicationController,
  PUBLICATION_FONT_SET,
  PUBLICATION_FONTS,
  PUBLICATION_PROFILE,
  type PublicationPort,
  type PublicationRequest,
  type PublicationResult,
} from '../../src/application/publication';
import { nativePublication } from '../../src/infrastructure/nativePublication';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const identity = {
  handle: 'handle',
  documentId: 'document',
  sessionId: 'session',
};
const snapshot = (version = 1) => ({
  version,
  source: [65, 13, 10],
  sourceSha256: 'a'.repeat(64),
  draftMetadata: {},
});
function result(r: PublicationRequest): PublicationResult {
  return {
    identity: r.identity,
    requestId: r.requestId,
    version: r.version,
    sourceSha256: r.sourceSha256,
    sourceBytes: r.source.length,
    artifact: `render-1-${r.requestId}`,
    pageCount: 2,
    profile: PUBLICATION_PROFILE,
    profileFrozen: true,
    fontSet: PUBLICATION_FONT_SET,
    renderer: { python: '3.13.16', screenplain: '0.12.0', reportlab: '4.4.7' },
    fonts: PUBLICATION_FONTS,
    sourceMap: 'unsupported',
    warnings: [],
  };
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
describe('captured publication contract', () => {
  it('copies exact capture before awaiting; no metadata/save state or paths cross the port', async () => {
    const pending = deferred<PublicationResult>();
    let captured!: PublicationRequest;
    const port: PublicationPort = {
      render: vi.fn((r) => {
        captured = r;
        return pending.promise;
      }),
      cancel: vi.fn(async () => {}),
    };
    const input = snapshot();
    const original = structuredClone(input);
    const controller = new PublicationController(identity, port);
    const job = controller.render(input);
    input.source[0] = 66;
    input.version = 99;
    expect(captured.source).toEqual(original.source);
    expect(captured.version).toBe(1);
    expect(Object.keys(captured).sort()).toEqual(
      [
        'identity',
        'requestId',
        'version',
        'source',
        'sourceSha256',
        'profile',
        'fontSet',
        'options',
      ].sort(),
    );
    pending.resolve(result(captured));
    expect((await job).pageCount).toBe(2);
  });
  it('rejects late results from superseded or cancelled jobs', async () => {
    const jobs: {
      r: PublicationRequest;
      d: ReturnType<typeof deferred<PublicationResult>>;
    }[] = [];
    const port: PublicationPort = {
      render: (r) => {
        const d = deferred<PublicationResult>();
        jobs.push({ r, d });
        return d.promise;
      },
      cancel: vi.fn(async () => {}),
    };
    const controller = new PublicationController(identity, port);
    const first = controller.render(snapshot(1));
    const firstAssertion = expect(first).rejects.toThrow('cancelled');
    const second = controller.render(snapshot(2));
    jobs[1]!.d.resolve(result(jobs[1]!.r));
    expect((await second).version).toBe(2);
    jobs[0]!.d.resolve(result(jobs[0]!.r));
    await firstAssertion;
    const third = controller.render(snapshot(3));
    const thirdAssertion = expect(third).rejects.toThrow('cancelled');
    await controller.cancel();
    jobs[2]!.d.resolve(result(jobs[2]!.r));
    await thirdAssertion;
    expect(port.cancel).toHaveBeenCalledWith({ identity, requestId: 3 });
  });
  it.each([
    'version',
    'sourceSha256',
    'sourceBytes',
    'requestId',
    'identity',
    'artifact',
    'pageCount',
    'profile',
    'profileFrozen',
    'fontSet',
    'sourceMap',
    'renderer',
    'fonts',
  ] as const)(
    'refuses a mismatched %s and releases the artifact',
    async (field) => {
      const changes: Record<string, unknown> = {
        version: 99,
        sourceSha256: 'b'.repeat(64),
        sourceBytes: 1,
        requestId: 99,
        identity: { ...identity, sessionId: 'foreign' },
        artifact: '/tmp/file.pdf',
        pageCount: 0,
        profile: 'screenplain-baseline',
        profileFrozen: false,
        fontSet: 'other',
        sourceMap: 'supported',
        renderer: {
          python: 'system',
          screenplain: '0.12.0',
          reportlab: '4.4.7',
        },
        fonts: [],
      };
      const port: PublicationPort = {
        render: async (r) =>
          ({ ...result(r), [field]: changes[field] }) as PublicationResult,
        cancel: vi.fn(async () => {}),
      };
      await expect(
        new PublicationController(identity, port).render(snapshot()),
      ).rejects.toThrow('invalid-response');
      expect(port.cancel).toHaveBeenCalledOnce();
    },
  );
  it('preserves typed native failures and leaves capture untouched', async () => {
    const input = snapshot();
    const before = structuredClone(input);
    const port: PublicationPort = {
      render: () => Promise.reject('timeout'),
      cancel: vi.fn(async () => {}),
    };
    await expect(
      new PublicationController(identity, port).render(input),
    ).rejects.toBe('timeout');
    expect(input).toEqual(before);
  });
  it('rejects stale versions/hash reuse and invalid byte captures before IPC', async () => {
    const port: PublicationPort = {
      render: async (r) => result(r),
      cancel: vi.fn(async () => {}),
    };
    const controller = new PublicationController(identity, port);
    await controller.render(snapshot(2));
    await expect(controller.render(snapshot(1))).rejects.toThrow(
      'stale-version',
    );
    await expect(
      controller.render({ ...snapshot(2), sourceSha256: 'b'.repeat(64) }),
    ).rejects.toThrow('stale-version');
    await expect(
      controller.render({ ...snapshot(3), source: [256] }),
    ).rejects.toThrow('invalid-request');
    await controller.close();
    await expect(controller.render(snapshot(3))).rejects.toThrow('cancelled');
  });
});

it('native adapter transmits the captured envelope and maps typed timeout failures', async () => {
  vi.mocked(invoke).mockRejectedValueOnce('timeout');
  const request = {
    identity,
    requestId: 1,
    ...snapshot(),
    profile: PUBLICATION_PROFILE,
    fontSet: PUBLICATION_FONT_SET,
    options: {},
  };
  const { draftMetadata: _metadata, ...envelope } = request;
  void _metadata;
  await expect(nativePublication.render(envelope)).rejects.toMatchObject({
    code: 'timeout',
  });
  expect(invoke).toHaveBeenCalledWith('render_publication', {
    request: envelope,
  });
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await nativePublication.cancel({ identity, requestId: 1 });
  expect(invoke).toHaveBeenCalledWith('cancel_publication', {
    request: { identity, requestId: 1 },
  });
});

it('malformed adapter responses cannot publish counts or artifacts', async () => {
  const port: PublicationPort = {
    render: async () => ({}) as PublicationResult,
    cancel: vi.fn(async () => {}),
  };
  await expect(
    new PublicationController(identity, port).render(snapshot()),
  ).rejects.toThrow('invalid-response');
  expect(port.cancel).toHaveBeenCalledOnce();
});
