import { describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import {
  WritingSession,
  type SessionEditor,
  type SessionPorts,
} from '../../src/application/writingSession';
import {
  requiresMoveProtection,
  validateWorkflowReceipt,
  type WorkflowProtectionRequest,
  type WorkflowProtectionReceipt,
} from '../../src/application/workflowProtection';
import { A, opened, receiptFor } from './persistence-fixtures';
import {
  createEditorState,
  applyEditorTransaction,
} from '../../src/editor/state';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import { captureEditor } from '../../src/editor/sourceBridge';

function protectedReceipt(
  request: WorkflowProtectionRequest,
): WorkflowProtectionReceipt {
  const cp = request.checkpoint;
  return {
    operation: request.operation,
    byteLength: cp.source.length,
    checkpoint: {
      identity: { ...cp.identity },
      version: cp.version,
      sourceSha256: cp.sourceSha256,
      generation: 1,
      protection: 'recoveryCheckpoint',
    },
    revision: {
      documentId: cp.identity.documentId,
      version: cp.version,
      sourceSha256: cp.sourceSha256,
      profileSha256: A,
      commitId: 'a'.repeat(40),
      changed: true,
      safetyRef: 'refs/safety/' + 'a'.repeat(40),
    },
  };
}
async function setup(readOnly = false) {
  let state = createEditorState(new TextEncoder().encode('!Original é🚀.\r\n'));
  let frozen = false,
    composing = false,
    unavailable = false;
  const editor: SessionEditor = {
    advanceVersion() {
      throw new Error('Reload unavailable in workflow fixture');
    },
    loadInitial() {},
    applySource() {},
    prepareSource: async () => {
      throw Error('unused');
    },
    retain: () => () => {},
    getVersion: () => state.plugins.length && captureEditor(state).version,
    captureDraft: async () => {
      throw Error('unused');
    },
    capture: async () => {
      if (unavailable)
        throw Error('Draft cannot be captured; Undo or emergency copy');
      const result = await boundary.capture();
      if (result.status !== 'current') throw Error('stale capture');
      return result.snapshot;
    },
    freeze: () => {
      if (frozen) throw Error('Already frozen');
      frozen = true;
      return () => {
        frozen = false;
      };
    },
    getSelection: () => ({
      anchor: state.selection.anchor,
      head: state.selection.head,
    }),
    setSelection() {},
    workflowState: () => ({ token: state, composing }),
    applyWorkflow: (apply) => apply(),
  };
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
  });
  const documents = {
    readInitial: vi.fn(async () => opened()),
    release: vi.fn(async () => {}),
    releaseAtRisk: vi.fn(async () => {}),
    checkpoint: vi.fn(
      async (request) =>
        protectedReceipt({ operation: 'sceneMove', checkpoint: request })
          .checkpoint,
    ),
    save: vi.fn(async (request) => ({
      ...receiptFor(request.version),
      sourceSha256: request.sourceSha256,
      recovery: protectedReceipt({
        operation: 'sceneMove',
        checkpoint: request,
      }).checkpoint,
    })),
  } satisfies SessionPorts['documents'];
  const protect = vi.fn(async (request: WorkflowProtectionRequest) =>
    protectedReceipt(request),
  );
  const document = opened();
  if (readOnly)
    document.ownership = { status: 'viewOnly', reasons: ['alreadyOwned'] };
  const ports = {
    entry: { createUnsaved: async () => document },
    documents,
    workflows: { protect },
    saveAs: {},
    snapshots: {},
  } as unknown as SessionPorts;
  const session = new WritingSession(ports, editor);
  await session.openNew();
  return {
    session,
    editor,
    documents,
    protect,
    get state() {
      return state;
    },
    get frozen() {
      return frozen;
    },
    change: () => {
      state = applyEditorTransaction(
        state,
        state.tr.insertText('Later ', 1),
      ).state;
    },
    select: () => {
      state = applyEditorTransaction(
        state,
        state.tr.setSelection(TextSelection.near(state.doc.resolve(3))),
      ).state;
    },
    compose: () => {
      composing = true;
    },
    refuseCapture: () => {
      unavailable = true;
    },
    ports,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('M4-04 workflow safety', () => {
  it('defines inclusive source-row/byte thresholds independently', () => {
    expect(requiresMoveProtection(49, 16383)).toBe(false);
    expect(requiresMoveProtection(50, 0)).toBe(true);
    expect(requiresMoveProtection(1, 16384)).toBe(true);
    for (const [rows, bytes] of [
      [0, 1],
      [1, -1],
      [1, 1.5],
      [NaN, 1],
    ])
      expect(() => requiresMoveProtection(rows!, bytes!)).toThrow();
  });
  it('validates every binding and a verified safety ref; recovery alone is insufficient', () => {
    const request: WorkflowProtectionRequest = {
      operation: 'sceneMove',
      checkpoint: {
        identity: opened().identity,
        version: 7,
        source: [97],
        sourceSha256: A,
        expectedFingerprint: null,
        draftMetadata: {},
      },
    };
    expect(() =>
      validateWorkflowReceipt(request, protectedReceipt(request)),
    ).not.toThrow();
    const mutations: ((r: WorkflowProtectionReceipt) => void)[] = [
      (r) => {
        r.operation = 'sectionMove';
      },
      (r) => {
        r.byteLength = 2;
      },
      (r) => {
        r.checkpoint.identity.sessionId = 'other';
      },
      (r) => {
        r.checkpoint.identity.handle = 'other';
      },
      (r) => {
        r.checkpoint.identity.documentId = 'other';
      },
      (r) => {
        r.checkpoint.version = 6;
      },
      (r) => {
        r.checkpoint.sourceSha256 = 'b'.repeat(64);
      },
      (r) => {
        r.checkpoint.generation = 0;
      },
      (r) => {
        r.revision.version = null;
      },
      (r) => {
        r.revision.documentId = 'other';
      },
      (r) => {
        r.revision.sourceSha256 = 'b'.repeat(64);
      },
      (r) => {
        r.revision.profileSha256 = 'bad';
      },
      (r) => {
        r.revision.commitId = 'bad';
      },
      (r) => {
        r.revision.safetyRef = null;
      },
    ];
    for (const mutate of mutations) {
      const receipt = protectedReceipt(request);
      mutate(receipt);
      expect(() => validateWorkflowReceipt(request, receipt)).toThrow();
    }
  });
  it('freezes exact live source/selection through protection, dispatches once synchronously and gives no file-save credit', async () => {
    const f = await setup();
    const before = f.state;
    const apply = vi.fn(() => {
      expect(f.frozen).toBe(true);
      expect(f.state).toBe(before);
      return true;
    });
    const result = await f.session.runProtectedWorkflow('sceneMove', apply);
    expect(result.status).toBe('applied');
    expect(apply).toHaveBeenCalledOnce();
    expect(f.frozen).toBe(false);
    expect(f.protect.mock.calls[0]![0].checkpoint.source).toEqual([
      ...new TextEncoder().encode('!Original é🚀.\r\n'),
    ]);
    expect(f.documents.save).not.toHaveBeenCalled();
    expect(f.session.cadenceStatus.fileSavedVersion).toBe(0);
    f.session.dispose();
  });
  it.each([
    'document',
    'selection',
    'composition',
    'identity',
    'cancel',
    'receipt',
  ] as const)(
    'refuses %s after the awaited native result without dispatch',
    async (kind) => {
      const f = await setup();
      const pending = deferred<WorkflowProtectionReceipt>();
      f.protect.mockImplementationOnce(() => pending.promise);
      const cancel = new AbortController();
      const apply = vi.fn(() => true);
      const result = f.session.runProtectedWorkflow(
        'sectionMove',
        apply,
        cancel.signal,
      );
      await vi.waitFor(() => expect(f.protect).toHaveBeenCalledOnce());
      const receipt = protectedReceipt(f.protect.mock.calls[0]![0]);
      if (kind === 'document') f.change();
      if (kind === 'selection') f.select();
      if (kind === 'composition') f.compose();
      if (kind === 'identity') f.session.dispose();
      if (kind === 'cancel') cancel.abort();
      if (kind === 'receipt') receipt.operation = 'sceneMove';
      const before = f.state;
      pending.resolve(receipt);
      expect((await result).status).toBe('refused');
      expect(apply).not.toHaveBeenCalled();
      expect(f.state).toBe(before);
      expect(f.frozen).toBe(false);
      f.session.dispose();
    },
  );
  it('rejects concurrent workflows, initial cancellation/composition and uncapturable drafts', async () => {
    const f = await setup();
    const pending = deferred<WorkflowProtectionReceipt>();
    f.protect.mockImplementationOnce(() => pending.promise);
    const apply = vi.fn(() => true);
    const first = f.session.runProtectedWorkflow('sceneMove', apply);
    await vi.waitFor(() => expect(f.protect).toHaveBeenCalledOnce());
    expect(
      (await f.session.runProtectedWorkflow('sceneMove', apply)).status,
    ).toBe('refused');
    pending.resolve(protectedReceipt(f.protect.mock.calls[0]![0]));
    await first;
    const abort = new AbortController();
    abort.abort();
    expect(
      (await f.session.runProtectedWorkflow('sceneMove', apply, abort.signal))
        .status,
    ).toBe('refused');
    f.refuseCapture();
    expect(
      (await f.session.runProtectedWorkflow('sceneMove', apply)).status,
    ).toBe('refused');
    expect(f.frozen).toBe(false);
    f.compose();
    expect(
      (await f.session.runProtectedWorkflow('sceneMove', apply)).status,
    ).toBe('refused');
    expect(f.protect).toHaveBeenCalledOnce();
    f.session.dispose();
  });
  it('history failure and refused dispatch preserve the draft; ordinary checkpoint/source Save remain independent', async () => {
    const f = await setup();
    const before = f.state;
    f.protect.mockRejectedValueOnce({ code: 'historyNeedsAttention' });
    const apply = vi.fn(() => true);
    const result = await f.session.runProtectedWorkflow('sceneMove', apply);
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toContain('Save');
    expect(f.state).toBe(before);
    expect(apply).not.toHaveBeenCalled();
    expect(f.frozen).toBe(false);
    expect((await f.session.save()).recovered).toBe(true);
    expect(f.documents.save).toHaveBeenCalled();
    expect(
      (await f.session.runProtectedWorkflow('sceneMove', () => false)).status,
    ).toBe('refused');
    f.session.dispose();
  });
});

it('refuses read-only, missing native protection and missing exact editor guards without dispatch', async () => {
  const readonly = await setup(true);
  const apply = vi.fn(() => true);
  expect(
    (await readonly.session.runProtectedWorkflow('sceneMove', apply)).status,
  ).toBe('refused');
  expect(readonly.protect).not.toHaveBeenCalled();
  readonly.session.dispose();
  const f = await setup();
  const port = f.ports.workflows;
  f.ports.workflows = undefined;
  expect(
    (await f.session.runProtectedWorkflow('sceneMove', apply)).status,
  ).toBe('refused');
  f.ports.workflows = port;
  f.editor.workflowState = undefined;
  expect(
    (await f.session.runProtectedWorkflow('sceneMove', apply)).status,
  ).toBe('refused');
  expect(f.protect).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
  f.session.dispose();
});
