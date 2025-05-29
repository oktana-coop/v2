import { next as Automerge } from '@automerge/automerge/slim';
import {
  decodeHeads,
  type DocHandle as AutomergeDocHandle,
  type DocHandleChangePayload as AutomergeDocHandleChangePayload,
  encodeHeads,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';

import {
  type Change,
  type Commit,
  headsAreSame,
  isCommittedChange,
  type UncommitedChange,
} from './commit';

export type VersionedArtifact<ArtifactType> = Automerge.Doc<ArtifactType>;

export type VersionedArtifactHandle<ArtifactType> =
  AutomergeDocHandle<ArtifactType>;

export type VersionedArtifactPatch = Automerge.Patch;

export type VersionedArtifactHandleChangePayload<T> =
  AutomergeDocHandleChangePayload<T>;

export const getArtifactAtCommit =
  <ArtifactType>(artifact: VersionedArtifact<ArtifactType>) =>
  (heads: UrlHeads): VersionedArtifact<ArtifactType> => {
    return Automerge.view(artifact, decodeHeads(heads));
  };

// TODO: Use heads instead of hashes
export const getDiff = async <ArtifactType>(
  artifactHandle: VersionedArtifactHandle<ArtifactType>,
  before: string,
  after: string
): Promise<Array<VersionedArtifactPatch> | null> => {
  const artifact = await artifactHandle.doc();
  if (artifact) {
    const patches = Automerge.diff(artifact, [before], [after]);
    return patches;
  }

  return null;
};

export type GetArtifactHandleHistoryResponse<ArtifactType> = {
  history: Change[];
  current: VersionedArtifact<ArtifactType>;
  latestChange: Change;
  lastCommit: Commit | null;
};

type ArtifactContentEqFn<ArtifactType> = (
  artifact: VersionedArtifact<ArtifactType>,
  heads1: UrlHeads,
  heads2: UrlHeads
) => boolean;

export const getArtifactHandleHistory = async <ArtifactType>(
  artifactHandle: VersionedArtifactHandle<ArtifactType>,
  contentEqFn: ArtifactContentEqFn<ArtifactType> = isArtifactContentSameAtHeads
): Promise<GetArtifactHandleHistoryResponse<ArtifactType>> => {
  const history = artifactHandle.history() || [];
  const changes = history
    .map((heads) => {
      const [head] = heads;
      // TODO: .metadata is "hidden", and prone to changes or even removal
      // but was the only way to construct the commit graph
      // (history of changes with messages & time)
      const changeMetadata = artifactHandle.metadata(head);
      return changeMetadata
        ? {
            ...changeMetadata,
            heads,
          }
        : null;
    })
    .filter((change) => change !== null);

  const [latestChangeMeta] = changes.slice(-1);
  const latestChange = {
    hash: latestChangeMeta.hash,
    heads: latestChangeMeta.heads,
    time: new Date(latestChangeMeta.time),
  } as UncommitedChange;

  const commits = changes.filter(isCommittedChange).map((change) => ({
    hash: change.hash,
    // TODO: cannot see why hash & heads are different things!
    heads: change.heads,
    message: change.message,
    time: new Date(change.time),
  })) as Array<Commit>;

  const orderedCommits = commits.reverse();
  const [lastCommit] = orderedCommits;

  const currentArtifact = await artifactHandle.doc();

  if (lastCommit) {
    return headsAreSame(latestChange.heads, lastCommit.heads) ||
      contentEqFn(currentArtifact, latestChange.heads, lastCommit.heads)
      ? {
          history: orderedCommits,
          current: currentArtifact,
          latestChange,
          lastCommit,
        }
      : {
          history: [latestChange, ...orderedCommits],
          current: currentArtifact,
          latestChange,
          lastCommit,
        };
  }

  return {
    history: [latestChange],
    current: currentArtifact,
    latestChange,
    lastCommit: null,
  };
};

export const isArtifactContentSameAtHeads = <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>,
  heads1: UrlHeads,
  heads2: UrlHeads
): boolean => {
  const diff = Automerge.diff(
    artifact,
    decodeHeads(heads1),
    decodeHeads(heads2)
  );
  return diff.length === 0;
};

export const getDiffFromPreviousCommit =
  <ArtifactType>(artifactHandle: VersionedArtifactHandle<ArtifactType>) =>
  async (
    current: UncommitedChange | Commit
  ): Promise<Array<VersionedArtifactPatch> | null> => {
    const { history } =
      await getArtifactHandleHistory<ArtifactType>(artifactHandle);
    const currentChangeIndex = history.findIndex(
      (item) => item.hash === current.hash
    );

    const previousChange = history[currentChangeIndex + 1];

    const artifact = await artifactHandle.doc();
    if (artifact) {
      const patches = Automerge.diff(
        artifact,
        [previousChange.hash],
        [current.hash]
      );

      return patches;
    }

    return null;
  };

export const getArtifactHeads = <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>
): UrlHeads => encodeHeads(Automerge.getHeads(artifact));
