import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CSS_PX_PER_INCH,
  type ExportTemplate,
  exportTemplateToCss,
  MM_PER_INCH,
} from '../../../../../modules/personalization';
import { sampleContent } from './sample-content';

type TemplatePreviewProps = {
  template: ExportTemplate;
};

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
  return devServerUrl ? `${devServerUrl}/preview.html` : '/preview.html';
};

const loadIframe = (iframe: HTMLIFrameElement): Promise<void> =>
  new Promise((resolve) => {
    iframe.onload = () => resolve();
    iframe.src = getPreviewUrl();
  });

const mmToPx = (mm: number): number => mm * (CSS_PX_PER_INCH / MM_PER_INCH);

const getPageWidthPx = (template: ExportTemplate): number => {
  const { paperSize, orientation } = template.pageSetup;
  const widthMm =
    orientation === 'landscape' ? paperSize.height : paperSize.width;
  return mmToPx(widthMm);
};

export const TemplatePreview = ({ template }: TemplatePreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth - 48; // padding
    const pageWidth = getPageWidthPx(template);
    setScale(Math.min(1, availableWidth / pageWidth));
  }, [template]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateScale]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      if (!iframeReady.current) {
        await loadIframe(iframe);
        iframeReady.current = true;
      }

      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) return;

      const stylesheet = exportTemplateToCss(template);
      await win.setContent({ html: sampleContent, stylesheet });

      // Inject preview-specific styles after pagination.
      // setContent cleans up old styles, so this won't accumulate.
      const styleEl = doc.createElement('style');
      styleEl.textContent = previewStyles;
      doc.head.appendChild(styleEl);

      updateScale();
      if (isLoading) setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [template]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col items-center overflow-auto"
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50">
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
        title="Template Preview"
      />
    </div>
  );
};
