import { invoke } from '@tauri-apps/api/core';
import type { FountainImportPort } from '../application/fountainImport';
export const nativeFountainImport: FountainImportPort = {
  protect(request) {
    return invoke('protect_fountain_import', { request });
  },
};
