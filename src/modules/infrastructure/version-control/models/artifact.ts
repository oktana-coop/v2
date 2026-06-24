import { type ResolvedArtifactId } from './resolved-artifact-id';

// This is the same with Automerge.Doc
// https://github.com/automerge/automerge/blob/main/javascript/src/types.ts#L29
// But we re-define it here so that we can re-use it for other version control systems without introducing confusion.
export type VersionedArtifact<ArtifactType> = {
  readonly [P in keyof ArtifactType]: ArtifactType[P];
};

export type ResolvedArtifact<
  ArtifactId extends ResolvedArtifactId,
  ArtifactType,
> = {
  id: ArtifactId;
  artifact: VersionedArtifact<ArtifactType>;
};
