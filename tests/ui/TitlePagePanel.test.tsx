import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { TitlePagePanel } from '../../src/app/TitlePagePanel';
import { createEditorState } from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import { applyTitlePage } from '../../src/editor/titlePage';

const views: ReturnType<typeof mountScreenplayEditor>[] = [];
afterEach(() => {
  cleanup();
  for (const v of views) v.destroy();
  views.length = 0;
});
function setup(options: { readOnly?: boolean; source?: string } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const draft = vi.fn();
  const close = vi.fn();
  const state = createEditorState(
    new Uint8Array(
      new TextEncoder().encode(
        options.source ??
          'Title: **Old**\nX-Custom: Keep\nAuthor: A\nAuthor: B\n\n!Body.',
      ),
    ),
  );
  const view = mountScreenplayEditor(host, state, {
    canEdit: () => !options.readOnly,
  });
  views.push(view);
  function Panel() {
    const [current, setCurrent] = useState(state);
    return (
      <TitlePagePanel
        document={captureEditor(current).document}
        state={current}
        getView={() => view}
        disabled={false}
        readOnly={options.readOnly ?? false}
        onDraft={draft}
        onClose={close}
        onApply={(apply) => {
          const ok = apply();
          setCurrent(view.state);
          return ok;
        }}
      />
    );
  }
  render(<Panel />);
  return { view, draft, close, original: captureEditor(state).source };
}
const edit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Edit field 1: Title' }));
const input = () => screen.getByRole('textbox', { name: 'Field value' });
const text = (view: ReturnType<typeof mountScreenplayEditor>) =>
  new TextDecoder().decode(captureEditor(view.state).source);

describe('title form drafts and exact-source commands', () => {
  it('opening/closing is byte no-op and focuses a keyboard exit', () => {
    const { view, original, close } = setup();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close title page' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    expect(captureEditor(view.state).source).toEqual(original);
  });
  it('labels uncommitted input, blocks Escape/close, Discard preserves bytes, Apply edits only the selected field', async () => {
    const { view, draft, close, original } = setup();
    edit();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Field key')),
    );
    fireEvent.change(input(), { target: { value: '**New**\nMore' } });
    expect(draft).toHaveBeenLastCalledWith(true, false);
    expect(screen.getByText(/Uncommitted title input/)).toBeTruthy();
    fireEvent.keyDown(input(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close title page' }));
    expect(close).not.toHaveBeenCalled();
    expect(captureEditor(view.state).source).toEqual(original);
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard title input' }),
    );
    expect(draft).toHaveBeenLastCalledWith(false, false);
    edit();
    fireEvent.change(input(), { target: { value: '**New**\nMore' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(text(view)).toBe(
      'Title: **New**\n    More\nX-Custom: Keep\nAuthor: A\nAuthor: B\n\n!Body.',
    );
    expect(screen.queryByRole('textbox', { name: 'Field value' })).toBeNull();
  });
  it('retains stale input and refuses submission after any editor state change', () => {
    const { view } = setup();
    edit();
    fireEvent.change(input(), { target: { value: 'Staged' } });
    view.dispatch(view.state.tr.insertText('changed'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(screen.getByRole('alert').textContent).toMatch(/stale/);
    expect((input() as HTMLTextAreaElement).value).toBe('Staged');
    expect(text(view)).not.toContain('Staged');
  });
  it('composition commit Enter cannot apply, discard or close; subsequent explicit Apply succeeds', () => {
    const { view, close } = setup();
    edit();
    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: '你好' } });
    fireEvent.keyDown(input(), { key: 'Escape', isComposing: true });
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(close).not.toHaveBeenCalled();
    expect(text(view)).toContain('**Old**');
    fireEvent.compositionEnd(input());
    expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(text(view)).toContain('Title: 你好');
    expect(
      fireEvent.keyDown(
        screen.getByRole('button', { name: 'Edit field 1: Title' }),
        { key: 'Enter' },
      ),
    ).toBe(true);
  });
  it('shows a representability refusal and retains the full staged input', () => {
    const { view, original } = setup();
    edit();
    fireEvent.change(input(), { target: { value: 'New\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((input() as HTMLTextAreaElement).value).toBe('New\n');
    expect(captureEditor(view.state).source).toEqual(original);
  });
  it('explicit add/remove/reorder keeps duplicate and unknown fields accessible', () => {
    const { view } = setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Move field 2: X-Custom up' }),
    );
    expect(text(view)).toContain('X-Custom: Keep\nTitle: **Old**');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove field 3: Author' }),
    );
    expect(text(view)).not.toContain('Author: A');
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    fireEvent.change(screen.getByLabelText('Field key'), {
      target: { value: 'Contact' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
    expect(text(view)).toContain('Author: B\nContact: \n\n!Body.');
  });
  it('read-only buttons and view composing refuse all changes, including direct command submission', () => {
    const { view, original } = setup({ readOnly: true });
    expect(view.dom.getAttribute('aria-readonly')).toBe('true');
    expect(
      (screen.getByRole('button', { name: 'Add field' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit field 1: Title' }),
    );
    expect(screen.queryByRole('textbox', { name: 'Field value' })).toBeNull();
    expect(applyTitlePage(view, view.state, { kind: 'remove', id: 'b0' })).toBe(
      false,
    );
    Object.defineProperty(view, 'composing', {
      value: true,
      configurable: true,
    });
    expect(applyTitlePage(view, view.state, { kind: 'remove', id: 'b0' })).toBe(
      false,
    );
    expect(captureEditor(view.state).source).toEqual(original);
  });
});
