import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThirdPartyNotices } from '../../src/app/ThirdPartyNotices';
import type { ThirdPartyNoticesPort } from '../../src/application/thirdPartyNotices';

afterEach(cleanup);

function setup(read: ThirdPartyNoticesPort['read'], open = true) {
  const port: ThirdPartyNoticesPort = { read };
  const onClose = vi.fn();
  render(<ThirdPartyNotices port={port} open={open} onClose={onClose} />);
  return { onClose };
}

it('renders nothing while closed and never calls the port', () => {
  const read = vi.fn(async () => ({ status: 'ready' as const, text: 'x' }));
  const { container } = render(
    <ThirdPartyNotices port={{ read }} open={false} onClose={() => {}} />,
  );
  expect(container.innerHTML).toBe('');
  expect(read).not.toHaveBeenCalled();
});

it('shows the retained notice text on demand and closes', async () => {
  const read = vi.fn(async () => ({
    status: 'ready' as const,
    text: '# babel third-party notices',
  }));
  const { onClose } = setup(read);
  expect(await screen.findByText('Reading notices…')).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByText('Bundled library licences'));
  expect(await screen.findByText('# babel third-party notices')).toBeTruthy();
  fireEvent.click(screen.getByText('Close notices'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('reports unavailability instead of inventing notices', async () => {
  setup(async () => ({
    status: 'unavailable' as const,
    reason: 'Third-party notices ship with the installed package.',
  }));
  expect(
    await screen.findByText(
      'Third-party notices ship with the installed package.',
    ),
  ).toBeTruthy();
});

it('closes on Escape', async () => {
  const { onClose } = setup(async () => ({
    status: 'ready' as const,
    text: 'notices',
  }));
  await screen.findByText('Reading notices…');
  fireEvent.keyDown(screen.getByLabelText('Third-party notices'), {
    key: 'Escape',
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
