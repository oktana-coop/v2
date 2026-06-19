import { WasmCLIType } from '../constants';

// A file to mount into the WASI virtual filesystem before running the CLI.
export type WasiFile = {
  path: string;
  bytes: Uint8Array;
};

export type RunWasiCLIArgs = {
  type: WasmCLIType;
  args: Array<string>;
  files?: ReadonlyArray<WasiFile>;
};

export type Wasm = {
  runWasiCLIOutputingText: (args: RunWasiCLIArgs) => Promise<string>;
  runWasiCLIOutputingBinary: (args: RunWasiCLIArgs) => Promise<Uint8Array>;
};
