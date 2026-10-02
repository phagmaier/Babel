import { describe, it, expect, vi } from 'vitest';
import {
  commandReason,
  dispatchCommand,
  type CommandContext,
} from '../../src/application/commandDispatch';
import { shortcutCommands } from '../../src/application/shortcuts';
const writing: CommandContext = {
  route: 'writing',
  native: true,
  ready: true,
  blocked: false,
  composing: false,
  staged: false,
  readOnly: false,
  form: false,
  undo: true,
  redo: true,
  navigation: true,
  matches: true,
};
describe('M4-14 shared live command boundary', () => {
  it('keeps Save available during PDF export while guarding identity changes and duplicate exports', () => {
    const execute = vi.fn();
    expect(
      dispatchCommand('save', { ...writing, exporting: true }, execute),
    ).toBe(true);
    for (const id of ['saveAs', 'open', 'closeSession', 'home', 'exportPdf'])
      expect(
        dispatchCommand(id, { ...writing, exporting: true }, execute),
      ).toBe(false);
    expect(
      dispatchCommand(
        'exportPdf',
        { ...writing, pdfAvailable: false },
        execute,
      ),
    ).toBe(false);
    expect(
      dispatchCommand('exportPdf', { ...writing, readOnly: true }, execute),
    ).toBe(false);
  });
  it('dispatches implemented workflows once and refuses unknown/future identifiers', () => {
    const execute = vi.fn();
    for (const id of [
      'replace',
      'scriptCheck',
      'spellcheck',
      'commandPalette',
      'nextScene',
      'save',
      'home',
      'exportPdf',
    ]) {
      expect(dispatchCommand(id, writing, execute)).toBe(true);
      expect(execute).toHaveBeenLastCalledWith(id);
    }
    expect(execute).toHaveBeenCalledTimes(8);
    for (const id of [
      'history',
      'upload',
      'getLatest',
      'shell',
      '/tmp/script',
      { id: 'save' },
    ])
      expect(dispatchCommand(id, writing, execute)).toBe(false);
    expect(execute).toHaveBeenCalledTimes(8);
    expect(new Set(shortcutCommands.map((command) => command.id)).size).toBe(
      shortcutCommands.length,
    );
  });
  it('rechecks composition/busy/staged/read-only facts and available Undo/navigation', () => {
    const execute = vi.fn();
    for (const change of [
      { blocked: true },
      { composing: true },
      { staged: true },
      { ready: false },
      { native: false },
      { readOnly: true },
    ])
      expect(dispatchCommand('save', { ...writing, ...change }, execute)).toBe(
        false,
      );
    expect(
      dispatchCommand('saveAs', { ...writing, readOnly: true }, execute),
    ).toBe(true);
    expect(
      dispatchCommand('nextScene', { ...writing, readOnly: true }, execute),
    ).toBe(true);
    for (const [id, change] of [
      ['undo', { undo: false }],
      ['redo', { redo: false }],
      ['nextScene', { navigation: false }],
      ['nextMatch', { matches: false }],
      ['format.bold', { form: true }],
    ] as const)
      expect(dispatchCommand(id, { ...writing, ...change }, execute)).toBe(
        false,
      );
    expect(
      commandReason(
        shortcutCommands.find((c) => c.id === 'undo')!,
        { ...writing, form: true },
      ),
    ).toContain('form owns');
  });
  it('Home invokes only existing entry services and preview retains enabled palette', () => {
    const execute = vi.fn();
    const context = { ...writing, route: 'home' as const };
    for (const id of ['new', 'newDestination', 'open'])
      expect(dispatchCommand(id, context, execute)).toBe(true);
    for (const id of ['save', 'home', 'nextScene', 'undo'])
      expect(dispatchCommand(id, context, execute)).toBe(false);
    expect(
      dispatchCommand('commandPalette', { ...context, native: false }, execute),
    ).toBe(true);
  });
});
