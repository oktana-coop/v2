import { type EffectErrorType } from '../../../../../../utils/effect';
import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../infrastructure/cross-platform';
import { PdfExportError, PdfExportErrorTag } from '../../../errors';
export { initPrintPage } from './print-page-entry';
import { type PdfEngine } from '../../../ports/pdf-engine';

export const createPagedJsElectronRendererAdapter = (): PdfEngine => ({
  printToPdf: (html) =>
    effectifyIPCPromise(
      {
        [PdfExportErrorTag]: PdfExportError,
      } as ErrorRegistry<EffectErrorType<ReturnType<PdfEngine['printToPdf']>>>,
      PdfExportError
    )(window.electronAPI.printToPDF(html)),
});
