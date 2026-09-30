import { afterEach, describe, expect, it } from 'vitest';
import { undo, redo } from 'prosemirror-history';
import {
  mountSpellcheckProbe,
  spellcheckSource,
} from '../native/spellcheck/probe';

let probe: ReturnType<typeof mountSpellcheckProbe> | undefined;
afterEach(() => {
  probe?.view.destroy();
  document.body.replaceChildren();
});
function open(canEdit?: () => boolean) {
  const host = document.createElement('div');
  document.body.append(host);
  probe = mountSpellcheckProbe(host, canEdit);
  // JSDOM has no layout; only the native probe verifies caret geometry.
  probe.view.setProps({ handleScrollToSelection: () => true });
  return probe;
}
const source = (current: ReturnType<typeof mountSpellcheckProbe>) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    Uint8Array.from(current.report().source),
  );
const observe = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('spellcheck probe source/DOM contracts (JSDOM, no native dictionary)', () => {
  it('presentation attributes and deferred reports preserve state/source/Undo', () => {
    const current = open();
    const state = current.view.state;
    expect(source(current)).toBe(spellcheckSource);
    current.view.setProps({ attributes: { spellcheck: 'false', lang: 'fr' } });
    current.suppressName(3, 0, 8);
    expect(current.view.state).toBe(state);
    expect(source(current)).toBe(spellcheckSource);
    expect(undo(current.view.state)).toBe(false);
  });

  it('accepts an explicit DOM text correction with exact origin/marks/Unicode and one Undo/Redo', async () => {
    const current = open();
    current.select(0, 13);
    const before = current.report();
    current.view.dom.querySelector('em')!.firstChild!.textContent = 'hello';
    await observe();
    expect(source(current)).toBe(spellcheckSource.replace('helllo', 'hello'));
    expect(
      current.view.state.doc
        .child(0)
        .child(1)
        .marks.map((m) => m.type.name),
    ).toEqual(['bold', 'italic']);
    expect(
      current
        .report()
        .rows.content?.map((row: { attrs: unknown }) => row.attrs),
    ).toEqual(before.rows.content?.map((row: { attrs: unknown }) => row.attrs));
    expect(undo(current.view.state, current.view.dispatch)).toBe(true);
    expect(source(current)).toBe(spellcheckSource);
    expect(current.report().selection).toEqual(before.selection);
    expect(undo(current.view.state)).toBe(false);
    expect(redo(current.view.state, current.view.dispatch)).toBe(true);
    expect(source(current)).toBe(spellcheckSource.replace('helllo', 'hello'));
  });

  it('keeps origin authoritative when a DOM text correction carries forged attributes', async () => {
    const current = open();
    const row = current.view.dom.querySelector('p')!;
    row.dataset.origin = JSON.stringify({
      ...current.view.state.doc.child(0).attrs,
      id: 'foreign',
    });
    row.querySelector('em')!.firstChild!.textContent = 'hello';
    await observe();
    expect(source(current)).toBe(spellcheckSource.replace('helllo', 'hello'));
    expect(current.view.state.doc.child(0).attrs.id).toBe('b0');
    expect(undo(current.view.state, current.view.dispatch)).toBe(true);
    expect(source(current)).toBe(spellcheckSource);
  });

  it('refuses a DOM correction during protection and retains the exact draft', async () => {
    let editable = true;
    const current = open(() => editable);
    editable = false;
    current.view.dom.querySelector('em')!.firstChild!.textContent = 'hello';
    await observe();
    expect(source(current)).toBe(spellcheckSource);
    expect(current.report().refusals).toEqual([
      'The editor is read-only or protecting a version',
    ]);
    expect(undo(current.view.state)).toBe(false);
  });
});
