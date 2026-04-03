import { BrowserWindow, ipcMain } from 'electron';

export const registerPdfIPCHandlers = () => {
  ipcMain.handle('print-to-pdf', async (_, html: string) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });

    try {
      await win.loadURL(
        `data:text/html;base64,${Buffer.from(html).toString('base64')}`
      );

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: 'Letter',
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      return new Uint8Array(pdfBuffer);
    } finally {
      win.destroy();
    }
  });
};
