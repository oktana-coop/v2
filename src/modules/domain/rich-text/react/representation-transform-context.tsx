import { createContext, useContext, useEffect, useState } from 'react';

import { WasmContext } from '../../../infrastructure/wasm/react/wasm-context';
import { createAdapter as createAutomergePandocAdapter } from '../adapters/automerge-pandoc-cli';
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
  const { runWasiCLI } = useContext(WasmContext);

  const [adapter, setAdapter] = useState<RepresentationTransform | null>(null);

  useEffect(() => {
    const automergePandocAdapter = createAutomergePandocAdapter({
      runWasiCLI,
    });

    setAdapter(automergePandocAdapter);
  }, [runWasiCLI]);

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
