import { createContext, useContext, useEffect, useState } from 'react';

import { isElectron } from '../../../infrastructure/cross-platform/browser-env';
import { WasmContext } from '../../../infrastructure/wasm/react/wasm-context';
import { createPagedJsBrowserAdapter } from '../adapters/paged-js-pdf-engine/browser';
import { createPagedJsElectronRendererAdapter } from '../adapters/paged-js-pdf-engine/electron-renderer';
import { createAdapter as createPandocRepresentationTransformAdapter } from '../adapters/pandoc-representation-transform';
import { type RepresentationTransform } from '../ports/representation-transform';

type RepresentationTransformContextType = {
  adapter: RepresentationTransform | null;
};

export const RepresentationTransformContext =
  createContext<RepresentationTransformContextType>({
    adapter: null,
  });

export const RepresentationTransformProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { runWasiCLIOutputingText, runWasiCLIOutputingBinary } =
    useContext(WasmContext);

  const [adapter, setAdapter] = useState<RepresentationTransform | null>(null);

  useEffect(() => {
    const pdfEngine = isElectron()
      ? createPagedJsElectronRendererAdapter({
          electronPrintToPdf: window.electronAPI.printToPDF,
        })
      : createPagedJsBrowserAdapter();

    const adapter = createPandocRepresentationTransformAdapter({
      runWasiCLIOutputingText,
      runWasiCLIOutputingBinary,
      pdfEngine,
    });

    setAdapter(adapter);
  }, [runWasiCLIOutputingText]);

  return (
    <RepresentationTransformContext.Provider
      value={{
        adapter,
      }}
    >
      {children}
    </RepresentationTransformContext.Provider>
  );
};
