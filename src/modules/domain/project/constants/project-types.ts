import type { ValueOf } from 'type-fest';

const SINGLE_DOCUMENT_PROJECT = 'SINGLE_DOCUMENT_PROJECT';
const MULTI_DOCUMENT_PROJECT = 'MULTI_DOCUMENT_PROJECT';

export const projectTypes = {
  SINGLE_DOCUMENT_PROJECT,
  MULTI_DOCUMENT_PROJECT,
} as const;

export type ProjectType = ValueOf<typeof projectTypes>;
