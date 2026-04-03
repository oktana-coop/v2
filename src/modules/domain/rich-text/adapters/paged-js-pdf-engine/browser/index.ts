import * as Effect from 'effect/Effect';
// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

import { PdfExportError } from '../../../errors';
import { type PdfEngine } from '../../../ports/pdf-engine';
import { getDefaultExportStylesheet } from '../common/default-stylesheet';

export const createPagedJsBrowserAdapter = (): PdfEngine => ({
  printToPdf: (html) =>
    Effect.tryPromise({
      try: async () => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc) {
          throw new Error('Could not access iframe document');
        }

        const css = getDefaultExportStylesheet();

        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>${css}</style>
            </head>
            <body></body>
          </html>
        `);
        iframeDoc.close();

        const previewer = new Previewer();
        await previewer.preview(html, [], iframeDoc.body);

        await new Promise<void>((resolve) => {
          iframe.contentWindow?.addEventListener(
            'afterprint',
            () => {
              document.body.removeChild(iframe);
              resolve();
            },
            { once: true }
          );

          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        });

        return new Uint8Array();
      },
      catch: (error) => new PdfExportError(String(error)),
    }),
});
