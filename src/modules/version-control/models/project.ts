import { next as Automerge } from '@automerge/automerge/slim';
import type { AutomergeUrl } from '@automerge/automerge-repo/slim';

import { DocHandle } from './doc-handle';

export type DocumentMetaData = {
  versionControlId: AutomergeUrl;
  name: string;
  // TODO: use relative path to project directory in this model
  path: string;
};

export type Project = {
  path: string;
  documents: Record<AutomergeUrl, DocumentMetaData>;
};

export type VersionedProject = Automerge.Doc<Project>;

export type VersionedProjectHandle = DocHandle<Project>;
