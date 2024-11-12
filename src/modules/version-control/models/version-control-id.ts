import {
  type AutomergeUrl,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo/slim';

export type VersionControlId = AutomergeUrl;

export const isValidVersionControlId = isValidAutomergeUrl;
