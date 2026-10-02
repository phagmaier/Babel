import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../../src/app/CommandPalette';
import { CommandSurface } from '../../src/app/CommandSurface';
import { ShortcutRegistry } from '../../src/application/shortcuts';
import type { CommandContext } from '../../src/application/commandDispatch';
import { nativeCommands } from '../../src/infrastructure/nativeCommands';
const context: CommandContext = {
  route: 'writing',
  native: true,
  ready: true,
  blocked: false,
  composing: false,
  staged: false,
  readOnly: false,
  form: false,
  undo: true,
  redo: false,
  navigation: true,
  matches: false,
};
const registry = () =>
  new ShortcutRegistry('other', { getItem: () => null, setItem: () => {} });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});
describe('M4-14 palette focus, routing and live native events', () => {
  it('filters actions/scene targets; Enter runs once and composition keeps Enter/Escape', async () => {
    const activate = vi.fn(),
      close = vi.fn();
    render(
      <CommandPalette
        entries={[
          { id: 'save', label: 'Save', hint: 'Ctrl+S', activate },
          {
            id: 'scene',
            label: 'Scene 2: ÉVA',
            hint: 'Navigate without editing',
            activate,
          },
        ]}
        onClose={close}
      />,
    );
    const input = screen.getByRole('combobox');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'éva' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {});
    expect(close).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });
  it('contains Tab focus, makes background inert, and Escape restores its trigger', () => {
    const mounted = render(
      <CommandSurface
        registry={registry()}
        context={() => context}
        execute={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Command Palette' });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByRole('combobox');
    expect(document.activeElement).toBe(input);
    expect(trigger.inert).toBe(true);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancel palette' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.inert).toBe(false);
    mounted.unmount();
  });
  it('has a visible rendering cap and no implicit action on empty results', () => {
    const close = vi.fn();
    render(
      <CommandPalette
        entries={Array.from({ length: 120 }, (_, i) => ({
          id: `${i}`,
          label: `Scene ${i}`,
          hint: '',
          activate: vi.fn(),
        }))}
        onClose={close}
      />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(100);
    expect(screen.getByRole('status').textContent).toContain('first 100');
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'absent' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'F6' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('uses remaps once, leaves form/IME keys alone and rechecks busy palette activation', async () => {
    const commands = registry(),
      execute = vi.fn();
    let facts = context;
    commands.remap('save', 'Mod+K');
    render(
      <>
        <input aria-label="Staged form" />
        <CommandSurface
          registry={commands}
          context={() => facts}
          execute={execute}
        />
      </>,
    );
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(execute).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(execute).toHaveBeenCalledOnce();
    const form = screen.getByLabelText('Staged form');
    form.focus();
    const key = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, isComposing: true });
    expect(execute).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Command Palette' }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Save' },
    });
    facts = { ...context, blocked: true };
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    await act(async () => {});
    expect(execute).toHaveBeenCalledOnce();
  });
  it('refuses stale/unknown/disabled native IDs after remap, busy change and disposal', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    let callback: Parameters<typeof nativeCommands.listen>[0] = () => {};
    let facts = context;
    vi.spyOn(nativeCommands, 'listen').mockImplementation(async (cb) => {
      callback = cb;
      return vi.fn<() => void>();
    });
    const publish = vi.spyOn(nativeCommands, 'publish').mockResolvedValue();
    const commands = registry(),
      execute = vi.fn();
    const mounted = render(
      <CommandSurface
        registry={commands}
        context={() => facts}
        execute={execute}
      />,
    );
    await act(async () => {});
    const first = publish.mock.calls.at(-1)![0];
    act(() => callback({ token: first.token, id: 'save' }));
    expect(execute).toHaveBeenCalledOnce();
    act(() => {
      commands.remap('save', 'Mod+K');
    });
    await act(async () => {});
    const latest = publish.mock.calls.at(-1)![0];
    expect(latest.commands.find((c) => c.id === 'save')?.binding).toBe('Mod+K');
    act(() => callback({ token: first.token, id: 'open' }));
    act(() => callback({ token: latest.token, id: '/tmp/private' }));
    act(() => callback({ token: latest.token, id: 'history' }));
    facts = { ...context, blocked: true };
    act(() => callback({ token: latest.token, id: 'open' }));
    expect(execute).toHaveBeenCalledOnce();
    mounted.unmount();
    act(() => callback({ token: latest.token, id: 'save' }));
    expect(execute).toHaveBeenCalledOnce();
    expect(
      publish.mock.calls.at(-1)![0].commands.every((c) => !c.enabled),
    ).toBe(true);
  });
  it('reports native publication failure without taking protection credit', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    vi.spyOn(nativeCommands, 'listen').mockResolvedValue(vi.fn());
    vi.spyOn(nativeCommands, 'publish').mockRejectedValue(
      new Error('private transport'),
    );
    render(
      <CommandSurface
        registry={registry()}
        context={() => context}
        execute={vi.fn()}
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Native menu update failed. Use the palette or visible controls.',
    );
  });
  it('retires an open palette when protection becomes busy and keeps an interrupted-dialog focus', () => {
    let facts = context;
    const commands = registry();
    const mounted = render(
      <CommandSurface
        registry={commands}
        context={() => facts}
        execute={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Command Palette' });
    trigger.focus();
    fireEvent.click(trigger);
    // A separately mounted protection panel can acquire newer focus.
    const retry = document.createElement('button');
    document.body.append(retry);
    retry.focus();
    facts = { ...context, blocked: true };
    mounted.rerender(
      <CommandSurface
        registry={commands}
        context={() => facts}
        execute={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(retry);
    retry.remove();
  });
  it('keeps listener failure visible after a successful menu publication', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    vi.spyOn(nativeCommands, 'listen').mockRejectedValue(
      new Error('private transport'),
    );
    vi.spyOn(nativeCommands, 'publish').mockResolvedValue();
    render(
      <CommandSurface
        registry={registry()}
        context={() => context}
        execute={vi.fn()}
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Native menus unavailable. Use the palette or visible controls.',
    );
  });
  it('refuses queued palette actions after route disposal', async () => {
    const execute = vi.fn();
    const mounted = render(
      <CommandSurface
        registry={registry()}
        context={() => context}
        execute={execute}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Command Palette' }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Save' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    mounted.unmount();
    await act(async () => {});
    expect(execute).not.toHaveBeenCalled();
  });
  it('discloses retained corrupt shortcut preferences at Home', () => {
    const commands = new ShortcutRegistry('other', {
      getItem: () => 'corrupt profile',
      setItem: vi.fn(),
    });
    render(
      <CommandSurface
        registry={commands}
        context={() => ({ ...context, route: 'home' })}
        execute={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Shortcut preferences could not be read; defaults are active.',
    );
  });
});
