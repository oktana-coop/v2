import { Wasm } from '../../ports/wasm';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): Wasm => ({
  runWasiCLIOutputingText: window.wasmAPI.runWasiCLIOutputingText,
  runWasiCLIOutputingBinary: window.wasmAPI.runWasiCLIOutputingBinary,
});
