import type { ValueOf } from 'type-fest';

export const AUTOMERGE_PANDOC = 'AUTOMERGE_PANDOC';

export const cliTypes = {
  AUTOMERGE_PANDOC,
} as const;

export type WasmCLIType = ValueOf<typeof cliTypes>;
