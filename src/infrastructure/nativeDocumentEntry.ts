import { invoke } from '@tauri-apps/api/core';
import type { DocumentEntryPort } from '../application/documentEntry';

export const nativeDocumentEntry: DocumentEntryPort = {
  createUnsaved() {
    return invoke('create_unsaved_draft', { request: {} });
  },
  openViaPicker() {
    return invoke('open_source_via_picker', { request: {} });
  },
  selectDestination(identity) {
    return invoke('select_destination', { request: identity });
  },
};
