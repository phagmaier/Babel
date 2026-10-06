import { invoke } from '@tauri-apps/api/core';
import type {
  ThirdPartyNoticesPort,
  ThirdPartyNoticesResult,
} from '../application/thirdPartyNotices';

const unavailable = (reason: string): ThirdPartyNoticesResult => ({
  status: 'unavailable',
  reason,
});

export const nativeThirdPartyNotices: ThirdPartyNoticesPort = {
  async read(): Promise<ThirdPartyNoticesResult> {
    try {
      const response = await invoke<{ text: string }>('third_party_notices');
      if (typeof response?.text !== 'string' || !response.text.trim())
        return unavailable(
          'Third-party notices ship with the installed package; they are unavailable here.',
        );
      return { status: 'ready', text: response.text };
    } catch {
      return unavailable(
        'Third-party notices ship with the installed package; they are unavailable here.',
      );
    }
  },
};

export const unavailableThirdPartyNotices: ThirdPartyNoticesPort = {
  async read(): Promise<ThirdPartyNoticesResult> {
    return unavailable(
      'Third-party notices ship with the installed package; they are unavailable here.',
    );
  },
};
