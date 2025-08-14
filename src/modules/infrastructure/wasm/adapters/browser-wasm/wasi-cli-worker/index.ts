import './polyfills';

import { init, WASI } from '@wasmer/wasi';

import { cliOutputTypes } from '../../../constants';
import {
  type FailureResult,
  type RunWasiCLIMessage,
  type SuccessBinaryResult,
  type SuccessTextResult,
} from './types';

self.onmessage = async (event) => {
  const { wasmModule, args, messageId, outputType } =
    event.data as RunWasiCLIMessage;

  try {
    await init();

    const wasi = new WASI({
      args,
    });

    await wasi.instantiate(wasmModule, {});

    wasi.start();

    if (outputType === cliOutputTypes.TEXT) {
      const output = wasi.getStdoutString();

      const message: SuccessTextResult = {
        messageId,
        success: true,
        output,
      };

      // Send the result back to the main thread
      self.postMessage(message);
    } else {
      const output = wasi.getStderrBuffer();

      const message: SuccessBinaryResult = {
        messageId,
        success: true,
        output,
      };

      // Send the result back to the main thread
      self.postMessage(message);
    }
  } catch (error) {
    const message: FailureResult = {
      messageId,
      success: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Error in running the WASI CLI in the web worker',
    };

    // Send the error back to the main thread
    self.postMessage(message);
  }
};
