import * as Effect from 'effect/Effect';

import { type PdfExportError } from '../errors';

export type PrintToPdfArgs = {
  html: string;
  stylesheet?: string;
};

export type PdfEngine = {
  printToPdf: (
    args: PrintToPdfArgs
  ) => Effect.Effect<Uint8Array, PdfExportError, never>;
};
