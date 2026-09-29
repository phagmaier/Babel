import { invoke } from '@tauri-apps/api/core';
import type { SaveAsPort } from '../application/saveAs';

export const nativeSaveAs: SaveAsPort = {
  selectDestination(identity) {
    return invoke('select_save_destination', { request: identity });
  },
  saveAs(request) {
    return invoke('save_as_copy', { request });
  },
};
