import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { EditorControls } from '../../src/app/EditorControls';
import {
  createEditorState,
  applyEditorTransaction,
} from '../../src/editor/state';
import {
  ShortcutRegistry,
  elementChoices,
} from '../../src/application/shortcuts';
afterEach(cleanup);
describe('M3-06 picker, menu/help and remap settings', () => {
  it('reflects caret/Mixed and enables implemented workflows while keeping future actions disabled', () => {
    let state = createEditorState(
      new TextEncoder().encode('\n!First.\n~River.\n'),
    );
    state = applyEditorTransaction(
      state,
      state.tr.setSelection(TextSelection.create(state.doc, 3)),
    ).state;
    const execute = vi.fn();
    const registry = new ShortcutRegistry('other', window.localStorage);
    const mounted = render(
      <EditorControls state={state} registry={registry} execute={execute} />,
    );
    const picker = screen.getByRole('combobox', {
      name: 'Element',
    }) as HTMLSelectElement;
    expect(picker.value).toBe('action');
    for (const [id] of elementChoices)
      expect([...picker.options].some((option) => option.value === id)).toBe(
        true,
      );
    fireEvent.change(picker, { target: { value: 'shot' } });
    expect(execute).toHaveBeenCalledWith('element.shot');
    state = applyEditorTransaction(
      state,
      state.tr.setSelection(TextSelection.create(state.doc, 3, 14)),
    ).state;
    mounted.rerender(
      <EditorControls state={state} registry={registry} execute={execute} />,
    );
    expect(picker.value).toBe('mixed');
    // Source saving shipped in M3-10, so Save is honestly enabled; only
    // not-yet-implemented workflow actions stay disabled.
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('button', { name: 'Export PDF' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    expect(execute).toHaveBeenLastCalledWith('exportPdf');
  });
  it('remaps through settings and updates command/help labels immediately; conflict and write failure stay visible', () => {
    const values = new Map<string, string>();
    const registry = new ShortcutRegistry('other', {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    });
    render(
      <EditorControls
        state={createEditorState(new Uint8Array())}
        registry={registry}
        execute={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Command' }), {
      target: { value: 'element.action' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Shortcut' }), {
      target: { value: 'Mod+K' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save shortcut' }));
    expect(screen.getByRole('status').textContent).toBe(
      'Shortcuts saved locally.',
    );
    expect(screen.getByText('Ctrl+K').tagName).toBe('KBD');
    fireEvent.change(screen.getByRole('textbox', { name: 'Shortcut' }), {
      target: { value: 'Mod+1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save shortcut' }));
    expect(screen.getByRole('status').textContent).toContain(
      'already assigned',
    );
    expect(registry.binding('element.action')).toBe('Mod+K');
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(screen.getByText('Ctrl+2').tagName).toBe('KBD');
  });
  it('storage refusal is visible and protected source has a truthful picker label', () => {
    const registry = new ShortcutRegistry('other');
    let state = createEditorState(new TextEncoder().encode('\n[[unclosed\n'));
    state = applyEditorTransaction(
      state,
      state.tr.setSelection(TextSelection.create(state.doc, 3)),
    ).state;
    render(
      <EditorControls state={state} registry={registry} execute={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Shortcut' }), {
      target: { value: 'Mod+K' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save shortcut' }));
    expect(screen.getByRole('status').textContent).toContain('unavailable');
  });
});
