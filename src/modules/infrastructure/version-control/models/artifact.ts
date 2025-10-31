import {
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
} from '@automerge/automerge-repo/slim';

import { type ResolvedArtifactId } from './resolved-artifact-id';

// This is the same with Automerge.Doc
// https://github.com/automerge/automerge/blob/main/javascript/src/types.ts#L29
// But we re-define it here so that we can re-use it for other version control systems without introducing confusion.
export type VersionedArtifact<ArtifactType> = {
  readonly [P in keyof ArtifactType]: ArtifactType[P];
};

export type ResolvedArtifact<ArtifactType> = {
  id: ResolvedArtifactId;
  artifact: VersionedArtifact<ArtifactType>;
  handle: VersionedArtifactHandle<ArtifactType> | null;
};

export type VersionedArtifactHandle<ArtifactType> =
  AutomergeDocHandle<ArtifactType>;

export type VersionedArtifactHandleChangePayload<T> =
  AutomergeDocHandleChangePayload<T>;
