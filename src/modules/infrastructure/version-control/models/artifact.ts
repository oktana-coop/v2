import { next as Automerge } from '@automerge/automerge/slim';
import {
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
} from '@automerge/automerge-repo/slim';

export type VersionedArtifact<ArtifactType> = Automerge.Doc<ArtifactType>;

export type VersionedArtifactHandle<ArtifactType> =
  AutomergeDocHandle<ArtifactType>;

export type VersionedArtifactPatch = Automerge.Patch;

export type VersionedArtifactHandleChangePayload<T> =
  AutomergeDocHandleChangePayload<T>;
