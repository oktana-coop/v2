import { cliTypes, type WasmCLIType } from '../../constants/cli-types';
import automergePandocWasm from '../../files/automerge-pandoc.wasm?url';
import type { RunWasiCLIArgs, Wasm } from '../../ports/wasm';
import type { RunWasiCLIMessage } from './wasi-cli-worker/types';

// Using a web worker because the WASM file has a big size and
// we don't want to block the main thread when initializing it.
const worker = new Worker(
  new URL('./wasi-cli-worker/index.ts', import.meta.url),
  { type: 'module' }
);

const getFilePath = ({ type }: { type: WasmCLIType }) => {
  switch (type) {
    case cliTypes.AUTOMERGE_PANDOC:
      return automergePandocWasm;
  }
};

const loadWasmCLIModules = async (): Promise<
  Record<WasmCLIType, WebAssembly.Module>
> => {
  // Using Promise.all to load all WASM files concurrently
  const wasmModules = await Promise.all(
    Object.values(cliTypes).map(async (type) => {
      const filePath = getFilePath({ type });
      const wasmModule = await WebAssembly.compileStreaming(fetch(filePath));
      const result: [WasmCLIType, WebAssembly.Module] = [type, wasmModule];
      return result;
    })
  );

  return wasmModules.reduce(
    (acc, [type, wasmModule]) => {
      acc[type] = wasmModule;
      return acc;
    },
    {} as Record<WasmCLIType, WebAssembly.Module>
  );
};

export const createAdapter = async (): Promise<Wasm> => {
  // Load all WASM modules during adapter creation
  const wasmCLIModules = await loadWasmCLIModules();

  return {
    runWasiCLI: async ({ type, args }: RunWasiCLIArgs) => {
      return new Promise((resolve, reject) => {
        // Listen for messages from the worker
        worker.onmessage = (event) => {
          const { success, output, error } = event.data;
          if (success) {
            resolve(output);
          } else {
            reject(new Error(error));
          }
        };

        const message: RunWasiCLIMessage = {
          wasmModule: wasmCLIModules[type],
          args,
        };

        // Post a message to the worker to start the WASI CLI execution
        worker.postMessage(message);
      });
    },
  };
};
