import { createContext, useContext, useEffect, useState } from 'react';

import { WasmContext } from '../../../infrastructure/wasm/react/wasm-context';
import { createAdapter as createPandocRepresentationTransformAdapter } from '../adapters/pandoc-representation-transform';
import { createPagedJsElectronRendererAdapter } from '../browser';
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
    const pdfEngine = createPagedJsElectronRendererAdapter();

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
