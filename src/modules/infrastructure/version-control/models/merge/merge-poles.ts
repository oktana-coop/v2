import type { ValueOf } from 'type-fest';

const MERGE_SOURCE = 'MERGE_SOURCE';
const MERGE_TARGET = 'MERGE_TARGET';

export const mergePoles = {
  MERGE_SOURCE,
  MERGE_TARGET,
} as const;

export type MergePole = ValueOf<typeof mergePoles>;
