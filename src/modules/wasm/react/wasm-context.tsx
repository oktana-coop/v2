import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ElectronContext } from '../../../modules/cross-platform/electron-context';
import {
  createBrowserWasmAdapter,
  createElectronRendererWasmAdapter,
} from '../';
import type { RunWasiCLIArgs, Wasm } from '../ports/wasm';

export type WasmContextType = Wasm;

export const WasmContext = createContext<WasmContextType>({
  // @ts-expect-error will get overriden below
  runWasiCLI: () => {},
});

export const WasmProvider = ({ children }: { children: React.ReactNode }) => {
  const [wasm, setWasm] = useState<Wasm | null>(null);
  const { isElectron } = useContext(ElectronContext);

  useEffect(() => {
    const loadWasmModules = async () => {
      try {
        if (isElectron) {
          const adapter = createElectronRendererWasmAdapter();
          setWasm(adapter);
        } else {
          const adapter = await createBrowserWasmAdapter();
          setWasm(adapter);
        }
      } catch (error) {
        setWasm(null);
        console.error('Failed to load WASM modules:', error);
      }
    };

    loadWasmModules();
  }, [isElectron]);

  const handleRunWasiCLI = useCallback(
    async (args: RunWasiCLIArgs) => {
      if (!wasm) {
        throw new Error(
          'WASM modules have not finished loading before trying to run the CLI'
        );
      }

      return wasm.runWasiCLI(args);
    },
    [wasm]
  );

  // TODO: Ideally, we want to render the child component tree even if wasm modules have not loaded yet.
  // Unfortunately, `handleRunWasiCLI` is not taking the newer value without this check even if `setWasm` is called.
  // TODO: Revisit this and fix the re-rendering issue.
  if (!wasm) {
    return <div>Loading WebAssembly modules...</div>;
  }

  return (
    <WasmContext.Provider value={{ runWasiCLI: handleRunWasiCLI }}>
      {children}
    </WasmContext.Provider>
  );
};
