import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SpellcheckPanel } from '../../src/app/SpellcheckPanel';
import type {
  SpellcheckController,
  SpellcheckPort,
  SpellcheckReply,
} from '../../src/application/spellcheck';
import { mountScreenplayEditor } from '../../src/editor/view';
import { createEditorState } from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import type { EditorView } from 'prosemirror-view';
let view: EditorView | null = null;
afterEach(() => {
  cleanup();
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});
const status: SpellcheckReply = {
  enabled: true,
  language: 'en_US',
  languages: ['en_US', 'en_US-large'],
  available: true,
  needsAttention: false,
  addedCount: 0,
  ignoredCount: 0,
  resource: 'injected offline backend',
  correct: [],
  suggestions: [],
};
function open(port: SpellcheckPort) {
  const host = document.createElement('div');
  document.body.append(host);
  let controller: SpellcheckController | null = null;
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode('!***helllo***\n')),
    { changed: () => controller?.invalidate() },
  );
  view.setProps({ handleScrollToSelection: () => true });
  render(
    <SpellcheckPanel
      port={port}
      getView={() => view}
      blocked={() => false}
      onController={(c) => {
        controller = c;
      }}
      onClose={() => {}}
    />,
  );
}

const button = (name: string | RegExp) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
it('offers keyboard controls and explicit correction with retained marks', async () => {
  open({
    request: async (req) => ({
      ...status,
      correct: (req.words ?? []).map(() => false),
      suggestions: req.action === 'suggest' ? ['hello'] : [],
    }),
  });
  await waitFor(() => expect(button('Check spelling').disabled).toBe(false));
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'Offline spellcheck' }),
  );
  fireEvent.click(button('Check spelling'));
  await waitFor(() => expect(button(/Review helllo/).disabled).toBe(false));
  fireEvent.click(button(/Review helllo/));
  await waitFor(() => expect(button('Use hello').disabled).toBe(false));
  fireEvent.click(button('Use hello'));
  expect(new TextDecoder().decode(captureEditor(view!.state).source)).toBe(
    '!***hello***\n',
  );
  expect(screen.getByRole('status').textContent).toContain(
    'Correction applied',
  );
});
it('shows missing resources without manuscript changes', async () => {
  open({
    request: async () => ({
      ...status,
      language: 'zz_ZZ',
      languages: [],
      available: false,
    }),
  });
  await screen.findByRole('alert');
  expect(button('Check spelling').disabled).toBe(true);
  expect(
    (screen.getByLabelText('Spelling language') as HTMLSelectElement).value,
  ).toBe('zz_ZZ');
  expect(new TextDecoder().decode(captureEditor(view!.state).source)).toBe(
    '!***helllo***\n',
  );
});
it('keeps failed Add visible and old dictionary state usable', async () => {
  open({
    request: async (req) => {
      if (req.action === 'add') throw new Error('failure');
      return {
        ...status,
        correct: (req.words ?? []).map(() => false),
        suggestions: [],
      };
    },
  });
  await waitFor(() => expect(button('Check spelling').disabled).toBe(false));
  fireEvent.click(button('Check spelling'));
  await waitFor(() => expect(button(/Review helllo/).disabled).toBe(false));
  fireEvent.click(button(/Review helllo/));
  await waitFor(() =>
    expect(button('Add to local dictionary').disabled).toBe(false),
  );
  fireEvent.click(button('Add to local dictionary'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'could not be confirmed',
    ),
  );
  expect(new TextDecoder().decode(captureEditor(view!.state).source)).toBe(
    '!***helllo***\n',
  );
});

it('reports the effective language and preserves keyboard focus when the native select is refreshed', async () => {
  open({
    request: async (request) => ({
      ...status,
      language: request.language ?? 'en_US',
    }),
  });
  await waitFor(() => expect(button('Check spelling').disabled).toBe(false));
  const select = screen.getByLabelText(
    'Spelling language',
  ) as HTMLSelectElement;
  select.focus();
  fireEvent.change(select, { target: { value: 'en_US-large' } });
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Spelling language') as HTMLSelectElement).value,
    ).toBe('en_US-large'),
  );
  expect(document.activeElement).toBe(
    screen.getByLabelText('Spelling language'),
  );
  expect(
    screen.getByText(/Effective spelling language:/).textContent,
  ).toContain('en_US-large (available)');
});
