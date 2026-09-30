import { TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { mountScreenplayEditor } from '../../../src/editor/view';
import { createEditorState } from '../../../src/editor/state';
import { captureEditor } from '../../../src/editor/sourceBridge';
import { localShortcutRegistry } from '../../../src/application/shortcuts';

/** Synthetic probe only; no native IPC, production activation or second authority. */
export const spellcheckSource =
  '\ufeff!Zoë reads ***helllo*** beside 👩🏽‍🚀 é and שלום.  \r\n\r\n@ZORVEXIA\r\nZorvexia meets Quorvexia.\r\n\r\n!Final action.\r\n';

export function mountSpellcheckProbe(
  host: HTMLElement,
  canEdit?: () => boolean,
) {
  const events: {
    kind: string;
    trusted: boolean;
    data: string | null;
    key?: string;
    ctrl?: boolean;
  }[] = [];
  const refusals: string[] = [];
  const view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(spellcheckSource)),
    {
      shortcuts: localShortcutRegistry('other'),
      canEdit,
      refused: (reason) => refusals.push(reason ?? 'Refused'),
    },
  );
  view.setProps({
    attributes: { tabindex: '0', spellcheck: 'true', lang: 'en' },
  });
  for (const kind of [
    'beforeinput',
    'input',
    'compositionstart',
    'compositionend',
    'keydown',
  ])
    view.dom.addEventListener(kind, (event) => {
      events.push({
        kind,
        trusted: event.isTrusted,
        data: (event as InputEvent).data ?? null,
        ...(event instanceof KeyboardEvent
          ? { key: event.key, ctrl: event.ctrlKey }
          : {}),
      });
    });
  return {
    view,
    reset(source = spellcheckSource) {
      view.setProps({ decorations: () => DecorationSet.empty });
      view.updateState(createEditorState(new TextEncoder().encode(source)));
      events.length = 0;
      refusals.length = 0;
    },
    select(row: number, start: number, end = start) {
      const node = view.state.doc.child(row);
      if (start < 0 || end < start || end > node.textContent.length)
        throw new Error('Invalid synthetic selection');
      let position = 1;
      for (let index = 0; index < row; index++)
        position += view.state.doc.child(index).nodeSize;
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(
            view.state.doc,
            position + start,
            position + end,
          ),
        ),
      );
      view.focus();
    },
    suppressName(row: number, start: number, end: number) {
      let position = 1;
      for (let index = 0; index < row; index++)
        position += view.state.doc.child(index).nodeSize;
      const decorations = DecorationSet.create(view.state.doc, [
        Decoration.inline(position + start, position + end, {
          spellcheck: 'false',
        }),
      ]);
      // A fixed synthetic range only; production must own version-bound derivation.
      view.setProps({ decorations: () => decorations });
    },
    report() {
      const captured = captureEditor(view.state);
      return {
        source: Array.from(captured.source),
        version: captured.version,
        selection: captured.selection,
        rows: view.state.doc.toJSON(),
        events: [...events],
        refusals: [...refusals],
        spellcheck: view.dom.spellcheck,
        userAgent: navigator.userAgent,
      };
    },
  };
}
