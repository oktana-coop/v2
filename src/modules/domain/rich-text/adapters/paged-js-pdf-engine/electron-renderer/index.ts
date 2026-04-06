import * as Effect from 'effect/Effect';

import { PdfExportError } from '../../../errors';
import { type PdfEngine } from '../../../ports/pdf-engine';

export const createPagedJsElectronRendererAdapter = ({
  electronPrintToPdf,
}: {
  electronPrintToPdf: (html: string) => Promise<Uint8Array>;
}): PdfEngine => ({
  printToPdf: (html) =>
    Effect.tryPromise({
      try: () => electronPrintToPdf(html),
      catch: (error) => new PdfExportError(String(error)),
    }),
});
