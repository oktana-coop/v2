import debounce from 'debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ExportTemplate,
  exportTemplateToCss,
  getPageWidthPx,
} from '../../../../../modules/personalization';

const DEBOUNCE_MS = 300;

const previewStyles = `
  html, body { background: transparent; }
  body { margin: 0; padding: 0; }
  .pagedjs_pages {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pagedjs_page {
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    margin-bottom: 40px;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #a3a3a3; border-radius: 4px; }
`;

const getPreviewUrl = (): string => {
  const devServerUrl = import.meta.env.VITE_DEV_SERVER_URL as
    | string
    | undefined;
  return devServerUrl ? `${devServerUrl}/preview.html` : './preview.html';
};

const loadIframe = (iframe: HTMLIFrameElement): Promise<void> =>
  new Promise((resolve) => {
    iframe.onload = () => resolve();
    iframe.src = getPreviewUrl();
  });

type PagedPreviewProps = {
  html: string | null;
  template: ExportTemplate;
  loadingClassName?: string;
};

export const PagedPreview = ({
  html,
  template,
  loadingClassName,
}: PagedPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);

  const stylesheet = exportTemplateToCss(template);
  const pageWidthPx = getPageWidthPx(template);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth - 48;
    setScale(Math.min(1, availableWidth / pageWidthPx));
  }, [pageWidthPx]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateScale]);

  const renderPreview = useMemo(
    () =>
      debounce(async (html: string, stylesheet: string) => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        if (!iframeReady.current) {
          await loadIframe(iframe);
          iframeReady.current = true;
        }

        const win = iframe.contentWindow;
        const doc = iframe.contentDocument;
        if (!win || !doc) return;

        await win.setContent({ html, stylesheet });

        const styleEl = doc.createElement('style');
        styleEl.textContent = previewStyles;
        doc.head.appendChild(styleEl);

        updateScale();
        setIsLoading(false);
      }, DEBOUNCE_MS),
    [updateScale]
  );

  useEffect(() => {
    if (html) {
      renderPreview(html, stylesheet);
    }

    return () => renderPreview.clear();
  }, [html, stylesheet, renderPreview]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col items-center overflow-auto"
    >
      {isLoading && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center ${loadingClassName ?? ''}`}
        >
          <span className="text-sm text-zinc-400">Rendering...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="flex-1 border-0"
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
        title="Paged Preview"
      />
    </div>
  );
};
