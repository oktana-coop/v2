export const getDefaultExportStylesheet = (): string => `
  @page {
    size: letter portrait;
    margin: 0.75in 1in;
  }

  body {
    font-family: serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
  }

  h1 { font-size: 24pt; font-weight: bold; margin-bottom: 12pt; }
  h2 { font-size: 18pt; font-weight: bold; margin-bottom: 10pt; }
  h3 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; }
  h4 { font-size: 12pt; font-weight: bold; margin-bottom: 6pt; }
  h5 { font-size: 11pt; font-weight: bold; margin-bottom: 6pt; }
  h6 { font-size: 10pt; font-weight: bold; margin-bottom: 6pt; }

  p { margin-bottom: 8pt; }

  ul, ol {
    list-style-position: outside;
    padding-left: 24pt;
    margin-left: 0;
    margin-bottom: 8pt;
  }
  ul { list-style-type: disc; }
  ol { list-style-type: decimal; }
  li { line-height: 1.5; }

  pre {
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    padding: 8pt;
    font-family: monospace;
    font-size: 10pt;
    white-space: pre-wrap;
    break-inside: avoid;
  }

  code {
    font-family: monospace;
    font-size: 10pt;
    background-color: #f5f5f5;
  }

  blockquote {
    border-left: 3pt solid #ccc;
    padding-left: 12pt;
    margin-bottom: 8pt;
    color: #333;
  }

  a { color: #1a0dab; text-decoration: underline; }

  img { max-width: 100%; break-inside: avoid; }

  hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
`;
