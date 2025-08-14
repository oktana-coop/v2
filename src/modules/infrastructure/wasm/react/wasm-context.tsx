import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import { createAdapter as createBrowserWasmAdapter } from '../adapters/browser-wasm';
import { createAdapter as createElectronRendererWasmAdapter } from '../adapters/electron-renderer-wasm';
import type { RunWasiCLIArgs, Wasm } from '../ports/wasm';

export type WasmContextType = Wasm;

export const WasmContext = createContext<WasmContextType>({
  // @ts-expect-error will get overriden below
  runWasiCLIOutputingText: () => {},
  // @ts-expect-error will get overriden below
  runWasiCLIOutputingBinary: () => {},
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

  const handleRunWasiCLIOutputingText = useCallback(
    async (args: RunWasiCLIArgs) => {
      if (!wasm) {
        throw new Error(
          'WASM modules have not finished loading before trying to run the CLI'
        );
      }

      return wasm.runWasiCLIOutputingText(args);
    },
    [wasm]
  );

  const handleRunWasiCLIOutputingBinary = useCallback(
    async (args: RunWasiCLIArgs) => {
      if (!wasm) {
        throw new Error(
          'WASM modules have not finished loading before trying to run the CLI'
        );
      }

      return wasm.runWasiCLIOutputingBinary(args);
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
    <WasmContext.Provider
      value={{
        runWasiCLIOutputingText: handleRunWasiCLIOutputingText,
        runWasiCLIOutputingBinary: handleRunWasiCLIOutputingBinary,
      }}
    >
      {children}
    </WasmContext.Provider>
  );
};
