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
  const { runWasiCLIOutputingText } = useContext(WasmContext);

  const [adapter, setAdapter] = useState<RepresentationTransform | null>(null);

  useEffect(() => {
    const automergePandocAdapter = createAutomergePandocAdapter({
      runWasiCLIOutputingText,
    });

    setAdapter(automergePandocAdapter);
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
