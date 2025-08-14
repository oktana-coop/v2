import { type CLIOutputType } from '../../../constants';

export type RunWasiCLIMessage = {
  messageId: number;
  wasmModule: WebAssembly.Module;
  args: Array<string>;
  outputType: CLIOutputType;
};

export type SuccessTextResult = {
  messageId: number;
  success: true;
  output: string;
};

export type SuccessBinaryResult = {
  messageId: number;
  success: true;
  output: Uint8Array;
};

export type FailureResult = {
  messageId: number;
  success: false;
  errorMessage: string;
};

export type RunWasiCLITextResult = SuccessTextResult | FailureResult;

export const isSuccessTextResult = (
  result: RunWasiCLITextResult
): result is SuccessTextResult => result.success;

export const isFailureTextResult = (
  result: RunWasiCLITextResult
): result is FailureResult => !result.success;

export type RunWasiCLIBinaryResult = SuccessBinaryResult | FailureResult;

export const isSuccessBinaryResult = (
  result: RunWasiCLIBinaryResult
): result is SuccessBinaryResult => result.success;

export const isFailureBinaryResult = (
  result: RunWasiCLIBinaryResult
): result is FailureResult => !result.success;
