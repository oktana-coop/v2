# Paged.js PDF Engine

Exporting to PDF using [Paged.js](https://pagedjs.org/) is achieved by coordinating two `PdfEngine` adapters (one used by Electron renderer process and one used by Electron's main process) and a hidden print window for rendering the paginated content.

## How it works in Electron

PDF export spans three Electron processes, coordinated via IPC:

```
Renderer (main window)        Main Process        Renderer (hidden print window)
       |                          |                           |
       |-- IPC: print-to-pdf ---->|                           |
       |                          |-- create BrowserWindow -->|
       |                          |-- load print.html ------->|
       |                          |-- executeJavaScript ------>|
       |                          |   (setContent + wait)     |
       |                          |                           |-- paginateHtml()
       |                          |                           |   (Paged.js Previewer
       |                          |                           |    + stylesheet injection)
       |                          |                           |
       |                          |                           |-- dispatch 'pagedjs:rendered'
       |                          |<- Promise resolves -------|
       |                          |                           |
       |                          |-- printToPDF() ---------->|
       |                          |<- PDF buffer -------------|
       |                          |-- close window            |
       |<- PDF bytes -------------|                           |
```

1. The **main window renderer** calls `window.electronAPI.printToPDF(html)` via the preload bridge, which sends an IPC message to the main process.

2. The **main process** (`electron-node/`) creates a hidden `BrowserWindow`, loads `print.html`, and executes a script that calls `setContent(html)` while listening for the `pagedjs:rendered` event.

3. The **hidden window renderer** (`electron-renderer/print-page-entry.ts`) receives the HTML, injects the default stylesheet into the document head, and runs Paged.js `Previewer.preview()`. Paged.js reads the `@page` rules from the stylesheet and paginates the content into pages. Once done, it dispatches `pagedjs:rendered`.

4. The **main process** calls `webContents.printToPDF()` with `preferCSSPageSize: true` and zero margins, so Paged.js fully controls the page layout. The resulting PDF buffer is returned to the main window renderer.

### Why a hidden BrowserWindow?

Paged.js is a document renderer that expects full control of the page and it needs a real DOM to paginate content. It measures element heights, splits content across pages, and generates CSS regions. This requires a full browser rendering context, which only a `BrowserWindow` provides in Electron. A separate lightweight entry point (`print.html`) is used to avoid loading the full application bundle.
