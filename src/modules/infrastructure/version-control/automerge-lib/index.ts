import * as Automerge from '@automerge/automerge/slim';
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

export type ArtifactHistoryInfo<ArtifactType> = {
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

export const getChangeMetadata =
  <ArtifactType>(artifact: VersionedArtifact<ArtifactType>) =>
  (heads: UrlHeads): Automerge.DecodedChange | undefined =>
    Automerge.inspectChange(artifact, decodeHeads(heads)[0]) ?? undefined;

export const getArtifactHeadsHistory = <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>
): UrlHeads[] =>
  Automerge.topoHistoryTraversal(artifact).map((h) =>
    encodeHeads([h])
  ) as UrlHeads[];

export const getArtifactHistory = async <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>,
  contentEqFn: ArtifactContentEqFn<ArtifactType> = isArtifactContentSameAtHeads
): Promise<ArtifactHistoryInfo<ArtifactType>> => {
  const headsHistory = getArtifactHeadsHistory(artifact);

  return mapHeadsToHistoryInfo({
    headsHistory,
    artifact,
    metadataExtractor: getChangeMetadata(artifact),
    contentEqFn,
  });
};

export const mapHeadsToHistoryInfo = <ArtifactType>({
  headsHistory,
  artifact,
  metadataExtractor,
  contentEqFn = isArtifactContentSameAtHeads,
}: {
  headsHistory: UrlHeads[];
  artifact: VersionedArtifact<ArtifactType>;
  metadataExtractor: (heads: UrlHeads) => Automerge.DecodedChange | undefined;
  contentEqFn: ArtifactContentEqFn<ArtifactType>;
}): ArtifactHistoryInfo<ArtifactType> => {
  const changes = headsHistory
    .map((heads) => {
      // TODO: .metadata is "hidden", and prone to changes or even removal
      // but was the only way to construct the commit graph
      // (history of changes with messages & time)
      const changeMetadata = metadataExtractor(heads);
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
    heads: latestChangeMeta.heads,
    time: new Date(latestChangeMeta.time),
  } as UncommitedChange;

  const commits = changes.filter(isCommittedChange).map((change) => ({
    heads: change.heads,
    message: change.message,
    time: new Date(change.time),
  })) as Array<Commit>;

  const orderedCommits = commits.reverse();
  const [lastCommit] = orderedCommits;

  if (lastCommit) {
    return headsAreSame(latestChange.heads, lastCommit.heads) ||
      contentEqFn(artifact, latestChange.heads, lastCommit.heads)
      ? {
          history: orderedCommits,
          current: artifact,
          latestChange,
          lastCommit,
        }
      : {
          history: [latestChange, ...orderedCommits],
          current: artifact,
          latestChange,
          lastCommit,
        };
  }

  return {
    history: [latestChange],
    current: artifact,
    latestChange,
    lastCommit: null,
  };
};

export const getArtifactHandleHistory = async <ArtifactType>(
  artifactHandle: VersionedArtifactHandle<ArtifactType>,
  contentEqFn: ArtifactContentEqFn<ArtifactType> = isArtifactContentSameAtHeads
): Promise<ArtifactHistoryInfo<ArtifactType>> => {
  const currentArtifact = await artifactHandle.doc();
  const headsHistory = artifactHandle.history() || [];

  const metadataExtractor = (heads: UrlHeads) =>
    artifactHandle.metadata(heads[0]);

  return mapHeadsToHistoryInfo({
    headsHistory,
    artifact: currentArtifact,
    metadataExtractor,
    contentEqFn,
  });
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

export const exportToBinary = <ArtifactType>(
  artifact: VersionedArtifact<ArtifactType>
): Uint8Array => Automerge.save(artifact);

export const importFromBinary = <ArtifactType>(
  data: Uint8Array
): VersionedArtifact<ArtifactType> =>
  Automerge.load(data, { allowMissingChanges: false });

export * from './migrations';
