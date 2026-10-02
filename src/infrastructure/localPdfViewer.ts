import { getDocument, PDFWorker, AnnotationMode } from 'pdfjs-dist';
import LocalWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';
import type { PdfViewerPort } from '../app/PublicationPreview';

export const localPdfViewer: PdfViewerPort = {
  async load(bytes, signal) {
    const port = new LocalWorker();
    const worker = PDFWorker.create({ port });
    const task = getDocument({
      data: bytes.slice(),
      worker,
      useSystemFonts: false,
      useWorkerFetch: false,
      enableXfa: false,
      stopAtErrors: true,
    });
    let disposed = false;
    const close = () => {
      if (disposed) return;
      disposed = true;
      void task
        .destroy()
        .catch(() => {})
        .finally(() => {
          worker.destroy();
          port.terminate();
        });
    };
    signal.addEventListener('abort', close, { once: true });
    if (signal.aborted) close();
    try {
      const pdf = await task.promise;
      if (disposed) throw new Error('cancelled');
      return {
        pages: pdf.numPages,
        async render(number, zoom, host, renderSignal) {
          const page = await pdf.getPage(number);
          if (renderSignal.aborted || disposed) throw new Error('cancelled');
          // At most one bounded, detached page canvas; never reuse an active render.
          const canvas = document.createElement('canvas');
          const viewport = page.getViewport({ scale: zoom });
          if (viewport.width * viewport.height > 4_000_000)
            throw new Error('page too large');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Read-only PDF page ${number}`);
          const rendering = page.render({
            canvas,
            viewport,
            annotationMode: AnnotationMode.DISABLE,
          });
          const cancel = () => rendering.cancel();
          renderSignal.addEventListener('abort', cancel, { once: true });
          try {
            await rendering.promise;
            const content = await page.getTextContent();
            if (renderSignal.aborted || disposed) throw new Error('cancelled');
            const text = content.items
              .map((item) =>
                'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
              )
              .join('');
            host.replaceChildren(canvas);
            return text;
          } finally {
            renderSignal.removeEventListener('abort', cancel);
            page.cleanup();
          }
        },
        close,
      };
    } catch (error) {
      close();
      throw error;
    }
  },
};
