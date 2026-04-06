import { join } from 'node:path';

import { BrowserWindow, ipcMain } from 'electron';

// Derive path relative to __dirname (dist/main/) rather than process.env.DIST,
// because electron-vite replaces process.env per-module at build time
// and this module gets an empty object.
const printHtml = join(__dirname, '../renderer/print.html');

const loadPrintPage = async (win: BrowserWindow): Promise<void> => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(`${devServerUrl}/print.html`);
  } else {
    await win.loadFile(printHtml);
  }
};

const setPrintPageHtmlAndRegisterEvents = async ({
  win,
  html,
  timeoutMs = 15_000,
}: {
  win: BrowserWindow;
  html: string;
  timeoutMs?: number;
}): Promise<void> => {
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Paged.js timed out')), ${timeoutMs});
      window.addEventListener('pagedjs:rendered', () => {
        clearTimeout(timeout);
        resolve();
      });
      window.setContent(${JSON.stringify(html)});
    });
  `);
};

export const registerPdfIPCHandlers = () => {
  ipcMain.handle('print-to-pdf', async (_, html: string) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });

    try {
      await loadPrintPage(win);
      await setPrintPageHtmlAndRegisterEvents({ win, html });

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      return new Uint8Array(pdfBuffer);
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  });
};
