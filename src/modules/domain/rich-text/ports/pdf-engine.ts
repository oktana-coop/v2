import * as Effect from 'effect/Effect';

import { type PdfExportError } from '../errors';

export type PdfEngine = {
  printToPdf: (
    html: string
  ) => Effect.Effect<Uint8Array, PdfExportError, never>;
};
