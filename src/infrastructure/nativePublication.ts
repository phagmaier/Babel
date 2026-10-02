import { invoke } from '@tauri-apps/api/core';
import {
  PublicationFailure,
  type PublicationErrorCode,
  type PublicationPort,
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
export const unavailablePublication: PublicationPort = {
  render: () => Promise.reject(new PublicationFailure('renderer-unavailable')),
  cancel: () => Promise.resolve(),
};

export const nativeExportAssessment: import('../application/exportAssessment').ExportAssessmentPort =
  {
    assess: (sources) => invoke('assess_publication', { request: { sources } }),
  };
