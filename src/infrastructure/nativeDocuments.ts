import { invoke } from '@tauri-apps/api/core';
import type { DocumentPort } from '../application/documents';

export const nativeDocuments: DocumentPort = {
  checkpoint(request) {
    return invoke('checkpoint_document', { request });
  },
  save(request) {
    return invoke('save_document', { request });
  },
  release(identity) {
    return invoke('release_open_document', { request: identity });
  },
  releaseAtRisk(identity) {
    return invoke('release_open_document_at_risk', { request: identity });
  },
};

export const nativeExternalSource: import('../application/documents').ExternalSourcePort =
  {
    check: (request) => invoke('check_source_document', { request }),
    reload: (request) => invoke('reload_source_document', { request }),
  };
