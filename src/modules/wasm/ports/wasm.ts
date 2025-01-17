import { WasmCLIType } from '../constants';

export type RunWasiCLIArgs = {
  type: WasmCLIType;
  args: Array<string>;
};

export type Wasm = {
  runWasiCLI: (args: RunWasiCLIArgs) => Promise<string>;
};
