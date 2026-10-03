import { invoke } from '@tauri-apps/api/core';
import {
  PublicationFailure,
  type PublicationErrorCode,
  type PublicationPort,
  type PublicationPreviewPort,
} from '../application/publication';
export const nativePublication: PublicationPort = {
  render: (request) =>
    invoke<Awaited<ReturnType<PublicationPort['render']>>>(
      'render_publication',
      { request },
    ).catch((error) => {
      throw new PublicationFailure(
        typeof error === 'string'
          ? (error as PublicationErrorCode)
          : 'internal',
      );
    }),
  cancel: (request) =>
    invoke<void>('cancel_publication', { request }).catch((error) => {
      throw new PublicationFailure(
        typeof error === 'string'
          ? (error as PublicationErrorCode)
          : 'internal',
      );
    }),
};

export const nativeExportAssessment: import('../application/exportAssessment').ExportAssessmentPort =
  {
    assess: (sources) => invoke('assess_publication', { request: { sources } }),
  };

export const nativePublicationPreview: PublicationPreviewPort = {
  ...nativePublication,
  read: async (request) => {
    const bytes = await invoke<ArrayBuffer>('read_publication', { request });
    return new Uint8Array(bytes);
  },
};
