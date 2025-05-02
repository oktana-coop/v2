export type RunWasiCLIMessage = {
  messageId: number;
  wasmModule: WebAssembly.Module;
  args: Array<string>;
};
