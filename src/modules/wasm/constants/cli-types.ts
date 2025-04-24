import type { ValueOf } from 'type-fest';

export const HS_LIB = 'HS_LIB';

export const cliTypes = {
  HS_LIB,
} as const;

export type WasmCLIType = ValueOf<typeof cliTypes>;
