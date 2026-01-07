import type { ValueOf } from 'type-fest';

const MERGE_SOURCE = 'MERGE_SOURCE';
const MERGE_DESTINATION = 'MERGE_DESTINATION';

export const mergePoles = {
  MERGE_SOURCE,
  MERGE_DESTINATION,
} as const;

export type MergePole = ValueOf<typeof mergePoles>;
