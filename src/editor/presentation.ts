import type { Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/** View-only follow. No state transaction, smooth scrolling, or manuscript scan. */
export class TypewriterScroll {
  private intentUntil = 0;
  private frame: number | null = null;
  private composing = false;
  private attached: EditorView | null = null;
  constructor(
    private readonly enabled: () => boolean,
    private readonly blocked: () => boolean,
  ) {}
  private cancel = () => {
    this.intentUntil = 0;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  };
  private key = (event: KeyboardEvent) => {
    if (
      event.isComposing ||
      event.keyCode === 229 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ['Dead', 'Process', 'PageUp', 'PageDown', 'Home', 'End'].includes(
        event.key,
      )
    ) {
      this.cancel();
      return;
    }
    if (
      event.key.length === 1 ||
      [
        'Enter',
        'Backspace',
        'Delete',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.key)
    )
      this.intentUntil = performance.now() + 150;
    else this.cancel();
  };
  private beforeInput = (event: InputEvent) => {
    if (
      !this.composing &&
      !event.isComposing &&
      [
        'insertText',
        'insertParagraph',
        'deleteContentBackward',
        'deleteContentForward',
      ].includes(event.inputType)
    )
      this.intentUntil = performance.now() + 150;
  };
  private compositionStart = () => {
    this.composing = true;
    this.cancel();
  };
  private compositionEnd = () => {
    this.composing = false;
    this.cancel();
  };
  attach(view: EditorView) {
    this.destroy();
    this.attached = view;
    view.dom.addEventListener('keydown', this.key, true);
    view.dom.addEventListener('beforeinput', this.beforeInput, true);
    view.dom.addEventListener('compositionstart', this.compositionStart, true);
    view.dom.addEventListener('compositionend', this.compositionEnd, true);
    view.dom.addEventListener('blur', this.cancel);
    window.addEventListener('wheel', this.cancel, {
      passive: true,
      capture: true,
    });
    window.addEventListener('touchstart', this.cancel, {
      passive: true,
      capture: true,
    });
    window.addEventListener('pointerdown', this.cancel, true);
  }
  changed(view: EditorView, transaction: Transaction) {
    // A navigation or dialog must also cancel a queued follow from earlier input.
    if (
      !this.enabled() ||
      this.blocked() ||
      this.composing ||
      view.composing ||
      !view.hasFocus() ||
      !view.state.selection.empty ||
      [
        'outlineNavigation',
        'findNavigation',
        'scriptCheckNavigation',
        'outlineMove',
        'titlePage',
        'paste',
        'uiEvent',
      ].some((k) => transaction.getMeta(k))
    ) {
      this.cancel();
      return;
    }
    if (
      !(transaction.docChanged || transaction.selectionSet) ||
      this.intentUntil < performance.now()
    )
      return;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    const doc = view.state.doc,
      selection = view.state.selection;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (
        !this.enabled() ||
        this.blocked() ||
        this.composing ||
        view.isDestroyed ||
        view.composing ||
        !view.hasFocus() ||
        view.state.doc !== doc ||
        !view.state.selection.eq(selection)
      )
        return;
      const coords = view.coordsAtPos(selection.head);
      const delta = (coords.top + coords.bottom) / 2 - window.innerHeight / 2;
      if (Math.abs(delta) > 2)
        window.scrollBy({ top: delta, behavior: 'instant' });
      this.intentUntil = 0;
    });
  }
  destroy() {
    this.cancel();
    const view = this.attached;
    if (view) {
      view.dom.removeEventListener('keydown', this.key, true);
      view.dom.removeEventListener('beforeinput', this.beforeInput, true);
      view.dom.removeEventListener(
        'compositionstart',
        this.compositionStart,
        true,
      );
      view.dom.removeEventListener('compositionend', this.compositionEnd, true);
      view.dom.removeEventListener('blur', this.cancel);
    }
    window.removeEventListener('wheel', this.cancel, true);
    window.removeEventListener('touchstart', this.cancel, true);
    window.removeEventListener('pointerdown', this.cancel, true);
    this.attached = null;
    this.composing = false;
  }
}
