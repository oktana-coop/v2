// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

export const paginate = async (html: string, css: string): Promise<string> => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      throw new Error('Could not access iframe document');
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${css}</style>
        </head>
        <body></body>
      </html>
    `);
    iframeDoc.close();

    const previewer = new Previewer();
    await previewer.preview(html, [], iframeDoc.body);

    return `<!DOCTYPE html>${iframeDoc.documentElement.outerHTML}`;
  } finally {
    document.body.removeChild(iframe);
  }
};
