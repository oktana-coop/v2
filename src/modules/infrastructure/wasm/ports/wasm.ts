import { WasmCLIType } from '../constants';

export type RunWasiCLIArgs = {
  type: WasmCLIType;
  args: Array<string>;
};

export type Wasm = {
  runWasiCLIOutputingText: (args: RunWasiCLIArgs) => Promise<string>;
  runWasiCLIOutputingBinary: (args: RunWasiCLIArgs) => Promise<Uint8Array>;
};
