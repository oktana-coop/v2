import { ipcMain } from 'electron';

import { type PdfEngine } from '../../modules/domain/rich-text';
import {
  PDF_IPC_CHANNEL,
  runPromiseSerializingErrorsForIPC,
} from '../../modules/infrastructure/cross-platform';

export const registerPdfIPCHandlers = ({
  pdfEngine,
}: {
  pdfEngine: PdfEngine;
}) => {
  ipcMain.handle(PDF_IPC_CHANNEL, async (_, html: string) =>
    runPromiseSerializingErrorsForIPC(pdfEngine.printToPdf(html))
  );
};
