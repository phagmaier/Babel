import { invoke } from '@tauri-apps/api/core';
import type { ExportPdfPort } from '../application/exportPdf';
export const nativeExportPdf: ExportPdfPort = {
  prepare: (checkpoint) =>
    invoke('prepare_pdf_capture', { request: { checkpoint } }),
  select: (request) => invoke('select_pdf_destination', { request }),
  render: (request) => invoke('render_pdf_export', { request }),
  publish: (request) => invoke('publish_pdf_export', { request }),
  cancel: (request) => invoke('cancel_pdf_export', { request }),
};
