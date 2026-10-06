import { afterEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { nativeThirdPartyNotices } from '../../src/infrastructure/nativeThirdPartyNotices';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it('invokes the registered native command and returns its verbatim text', async () => {
  vi.mocked(invoke).mockResolvedValue({ text: '# notices' });
  const result = await nativeThirdPartyNotices.read();
  expect(invoke).toHaveBeenCalledWith('third_party_notices');
  expect(result).toEqual({ status: 'ready', text: '# notices' });
});

it('reports unavailability instead of inventing notices', async () => {
  vi.mocked(invoke).mockRejectedValue(new Error('missing'));
  const result = await nativeThirdPartyNotices.read();
  expect(result.status).toBe('unavailable');
  vi.mocked(invoke).mockResolvedValue({ text: '   ' });
  expect((await nativeThirdPartyNotices.read()).status).toBe('unavailable');
});
