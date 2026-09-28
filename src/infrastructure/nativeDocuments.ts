import { invoke } from '@tauri-apps/api/core';
import type { DocumentPort } from '../application/documents';

export const nativeDocuments: DocumentPort = {
  readInitial(identity) {
    return invoke('read_open_document', { request: identity });
  },
  release(identity) {
    return invoke('release_open_document', { request: identity });
  },
};
