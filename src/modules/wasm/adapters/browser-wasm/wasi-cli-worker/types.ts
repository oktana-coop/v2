export type RunWasiCLIMessage = {
  wasmModule: WebAssembly.Module;
  args: Array<string>;
};
