import * as Effect from 'effect/Effect';

import { PdfExportError } from '../../../errors';
import { type PdfEngine } from '../../../ports/pdf-engine';
import { getDefaultExportStylesheet } from '../common/default-stylesheet';

const buildHtmlDocument = (html: string, css: string): string => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>${css}</style>
    </head>
    <body>${html}</body>
  </html>
`;

export const createPagedJsElectronRendererAdapter = ({
  electronPrintToPdf,
}: {
  electronPrintToPdf: (html: string) => Promise<Uint8Array>;
}): PdfEngine => ({
  printToPdf: (html) =>
    Effect.tryPromise({
      try: async () => {
        const css = getDefaultExportStylesheet();
        const fullHTML = buildHtmlDocument(html, css);
        return electronPrintToPdf(fullHTML);
      },
      catch: (error) => new PdfExportError(String(error)),
    }),
});
