import type { EditorView } from 'prosemirror-view';
import { LocalCompletion } from '../editor/completion';
import './completion-popup.css';

/** Anchored local listbox; mousedown never moves the writing caret into a button. */
export function createCompletionPopup(host: HTMLElement) {
  const popup = document.createElement('div');
  popup.className = 'completion-popup';
  popup.id = `completion-${crypto.randomUUID()}`;
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', 'Screenplay suggestions');
  host.append(popup);
  let view: EditorView | undefined;
  const controller = new LocalCompletion(render);
  function render(current: LocalCompletion) {
    popup.replaceChildren();
    const offer = current.offer;
    popup.hidden = !offer;
    if (!offer || !view || view.isDestroyed) {
      view?.dom.removeAttribute('aria-controls');
      view?.dom.removeAttribute('aria-activedescendant');
      view?.dom.setAttribute('aria-expanded', 'false');
      return;
    }
    const coords = view.coordsAtPos(offer.caret);
    popup.style.left = `${Math.max(8, Math.min(coords.left, window.innerWidth - 280))}px`;
    popup.style.top = `${coords.bottom + 4}px`;
    popup.dataset.segment = offer.segment;
    offer.items.forEach((text, index) => {
      const item = document.createElement('div');
      item.id = `${popup.id}-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === current.selected));
      item.textContent = text;
      item.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        controller.accept(index, offer);
      });
      popup.append(item);
    });
    view.dom.setAttribute('aria-autocomplete', 'list');
    view.dom.setAttribute('aria-controls', popup.id);
    view.dom.setAttribute('aria-expanded', 'true');
    view.dom.setAttribute(
      'aria-activedescendant',
      `${popup.id}-${current.selected}`,
    );
    // Keep the compact popup within the viewport, including when the caret is near its bottom.
    if (coords.bottom + popup.offsetHeight + 4 > window.innerHeight)
      popup.style.top = `${Math.max(8, coords.top - popup.offsetHeight - 4)}px`;
  }
  const reposition = () => render(controller);
  const resize =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(reposition);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);
  return {
    controller,
    bind(editor: EditorView) {
      view = editor;
      resize?.observe(editor.dom);
      controller.changed(editor);
    },
    destroy() {
      resize?.disconnect();
      controller.destroy();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      view?.dom.removeAttribute('aria-autocomplete');
      popup.remove();
      view = undefined;
    },
  };
}
