import { cliTypes, type WasmCLIType } from '../../constants/cli-types';
import hsLib from '../../files/v2-hs-lib.wasm?url';
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
    case cliTypes.HS_LIB:
      return hsLib;
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
  const wasmCLIModules = await loadWasmCLIModules();

  // Assign a unique ID to each message sent to the worker and include it in the worker's response.
  // This way, the worker's response is matched to the correct promise.
  let messageId = 0; // Unique ID for each message

  return {
    runWasiCLI: async ({ type, args }: RunWasiCLIArgs) => {
      return new Promise((resolve, reject) => {
        const currentMessageId = messageId++;

        const handleMessage = (event: MessageEvent) => {
          const { messageId, success, output, error } = event.data;

          if (messageId === currentMessageId) {
            worker.removeEventListener('message', handleMessage); // Clean up listener
            if (success) {
              resolve(output);
            } else {
              reject(new Error(error));
            }
          }
        };

        worker.addEventListener('message', handleMessage);

        const message: RunWasiCLIMessage = {
          messageId: currentMessageId,
          wasmModule: wasmCLIModules[type],
          args,
        };

        worker.postMessage(message);
      });
    },
  };
};
