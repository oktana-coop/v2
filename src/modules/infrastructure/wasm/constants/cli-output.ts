import type { ValueOf } from 'type-fest';

export const TEXT = 'TEXT';
export const BINARY = 'BINARY';

export const cliOutputTypes = {
  TEXT,
  BINARY,
} as const;

export type CLIOutputType = ValueOf<typeof cliOutputTypes>;
