import { invoke } from '@tauri-apps/api/core';
import type { SpellcheckPort } from '../application/spellcheck';
export const nativeSpellcheck: SpellcheckPort = {
  request: (request) => invoke('spellcheck', { request }),
};
