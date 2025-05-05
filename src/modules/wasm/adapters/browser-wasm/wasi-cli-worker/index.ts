import './polyfills';

import { init, WASI } from '@wasmer/wasi';

import type { RunWasiCLIMessage } from './types';

self.onmessage = async (event) => {
  const { wasmModule, args, messageId } = event.data as RunWasiCLIMessage;

  try {
    await init();

    const wasi = new WASI({
      args,
    });

    await wasi.instantiate(wasmModule, {});

    wasi.start();
    const output = wasi.getStdoutString();

    // Send the result back to the main thread
    self.postMessage({
      messageId,
      success: true,
      output,
    });
  } catch (error) {
    // Send the error back to the main thread
    self.postMessage({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error in running the WASI CLI in the web worker',
    });
  }
};
