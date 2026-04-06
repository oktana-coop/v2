import * as Effect from 'effect/Effect';

import { PdfExportError } from '../../../errors';
import { type PdfEngine } from '../../../ports/pdf-engine';
import { paginateHtml } from '../common/paginate-html';

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

        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body></body>
          </html>
        `);
        iframeDoc.close();

        await paginateHtml({
          html,
          container: iframeDoc.body,
          document: iframeDoc,
        });

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
