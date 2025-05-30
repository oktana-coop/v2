import { next as Automerge } from '@automerge/automerge/slim';
import {
  decodeHeads,
  encodeHeads,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { fromNullable } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../errors';
import {
  type Change,
  type Commit,
  headsAreSame,
  isCommittedChange,
  type UncommitedChange,
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../models';

export type GetArtifactHandleHistoryResponse<ArtifactType> = {
  history: Change[];
  current: VersionedArtifact<ArtifactType>;
  latestChange: Change;
  lastCommit: Commit | null;
};

export type ArtifactContentEqFn<ArtifactType> = (
  artifact: VersionedArtifact<ArtifactType>,
  heads1: UrlHeads,
  heads2: UrlHeads
) => boolean;

export const getArtifactFromHandle: <ArtifactType>(
  handle: VersionedArtifactHandle<ArtifactType>
) => Effect.Effect<
  VersionedArtifact<ArtifactType>,
  RepositoryError | NotFoundError,
  never
> = (handle) =>
  pipe(
    Effect.tryPromise({
      try: async () => await handle.doc(),
      catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
    }),
    Effect.flatMap((doc) =>
      fromNullable(doc, () => new NotFoundError('Doc not found in handle'))
    )
  );

export const getArtifactHandleAtCommit: <ArtifactType>(args: {
  artifactHandle: VersionedArtifactHandle<ArtifactType>;
  heads: UrlHeads;
}) => Effect.Effect<
  VersionedArtifactHandle<ArtifactType>,
  RepositoryError,
  never
> = ({ artifactHandle, heads }) =>
  Effect.try({
    try: () => artifactHandle.view(heads),
    catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
  });

export const getArtifactAtCommit: <ArtifactType>(args: {
  artifact: VersionedArtifact<ArtifactType>;
  heads: UrlHeads;
}) => Effect.Effect<
  VersionedArtifact<ArtifactType>,
  RepositoryError,
  never
> = ({ artifact, heads }) =>
  Effect.try({
    try: () => Automerge.view(artifact, decodeHeads(heads)),
    catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
  });

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

export const getArtifactHeads = <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>
): UrlHeads => encodeHeads(Automerge.getHeads(artifact));
