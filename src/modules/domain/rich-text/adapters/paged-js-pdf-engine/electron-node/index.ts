import { join } from 'node:path';

import * as Effect from 'effect/Effect';
import { BrowserWindow } from 'electron';

import { PdfExportError } from '../../../errors';
import { type PdfEngine } from '../../../ports/pdf-engine';
import {
  PAGEDJS_RENDERED_EVENT,
  PAGEDJS_TIMEOUT_MS,
} from '../common/constants';

// Derive path relative to __dirname (dist/main/) rather than process.env.DIST,
// because electron-vite replaces process.env per-module at build time.
const printHtml = join(__dirname, '../renderer/print.html');

const loadPrintPage = async (win: BrowserWindow): Promise<void> => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(`${devServerUrl}/print.html`);
  } else {
    await win.loadFile(printHtml);
  }
};

const setPrintPageHtmlAndWaitForRendering = async ({
  win,
  html,
  stylesheet,
}: {
  win: BrowserWindow;
  html: string;
  stylesheet?: string;
}): Promise<void> => {
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Paged.js timed out')), ${PAGEDJS_TIMEOUT_MS});
      window.addEventListener('${PAGEDJS_RENDERED_EVENT}', () => {
        clearTimeout(timeout);
        resolve();
      });
      window.setContent({ html: ${JSON.stringify(html)}, stylesheet: ${JSON.stringify(stylesheet)} });
    });
  `);
};

export const createAdapter = (): PdfEngine => ({
  printToPdf: ({ html, stylesheet }) =>
    Effect.tryPromise({
      try: async () => {
        const win = new BrowserWindow({
          show: false,
          webPreferences: { offscreen: true },
        });

        try {
          await loadPrintPage(win);
          await setPrintPageHtmlAndWaitForRendering({ win, html, stylesheet });

          const pdfBuffer = await win.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });

          return new Uint8Array(pdfBuffer);
        } finally {
          if (!win.isDestroyed()) {
            win.close();
          }
        }
      },
      catch: (error) => new PdfExportError(String(error)),
    }),
});
