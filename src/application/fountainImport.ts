import type { EditorView } from 'prosemirror-view';
import { MAX_SOURCE_BYTES } from './persistenceState';
import { sourceImportTransaction } from '../editor/state';
import { dispatchIsolated } from '../editor/formatting';

export type ImportResult =
  | {
      status: 'imported';
      protection: import('./workflowProtection').WorkflowProtectionReceipt;
    }
  | { status: 'refused'; reason: string };

/** Explicit whole-screenplay import, never the ordinary clipboard path. */
export class FountainImportBoundary {
  private busy = false;
  constructor(
    private readonly getView: () => EditorView,
    private readonly coordinated: (
      apply: () => boolean,
      signal?: AbortSignal,
    ) => Promise<import('./workflowProtection').WorkflowResult>,
  ) {}
  async import(bytes: Uint8Array, signal?: AbortSignal): Promise<ImportResult> {
    if (this.busy)
      return {
        status: 'refused',
        reason: 'An import is already pending; imported content retained',
      };
    if (bytes.length > MAX_SOURCE_BYTES)
      return {
        status: 'refused',
        reason: 'Import exceeds the local source limit; content retained',
      };
    const immutable = bytes.slice();
    const view = this.getView();
    const state = view.state;
    if (view.composing || view.isDestroyed)
      return {
        status: 'refused',
        reason: 'Finish composing before importing Fountain',
      };
    this.busy = true;
    try {
      const result = await this.coordinated(() => {
        if (
          this.getView() !== view ||
          view.state !== state ||
          view.isDestroyed ||
          view.composing
        )
          return false;
        const transaction = sourceImportTransaction(state, immutable);
        dispatchIsolated(view, transaction);
        return view.state.doc === transaction.doc;
      }, signal);
      return result.status === 'applied'
        ? { status: 'imported', protection: result.protection }
        : result;
    } finally {
      this.busy = false;
    }
  }
}
