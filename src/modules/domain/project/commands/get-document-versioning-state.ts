import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  type Change,
  changeIdsAreSame,
} from '../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../utils/effect';
import { type ProjectId } from '../models';
import { type GetDocumentHistoryResponse, type ProjectStore } from '../ports';

export type DocumentVersioningState = {
  history: Change[];
  canCommit: boolean;
};

export type GetDocumentVersioningStateDeps<E> = {
  getDocumentHistory: ProjectStore['getDocumentHistory'];
  isContentSameAtChanges: ProjectStore['isContentSameAtChanges'];
  // The document's current stored content, read for the kind of document.
  readDocumentContent: (args: {
    projectId: ProjectId;
    documentId: ArtifactId;
  }) => Effect.Effect<string, E>;
};

export type GetDocumentVersioningStateArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

const hasCommittableChanges =
  <E>({
    isContentSameAtChanges,
    readDocumentContent,
  }: Pick<
    GetDocumentVersioningStateDeps<E>,
    'isContentSameAtChanges' | 'readDocumentContent'
  >) =>
  ({
    projectId,
    documentId,
    historyInfo: { latestChange, lastCommit },
  }: GetDocumentVersioningStateArgs & {
    historyInfo: GetDocumentHistoryResponse;
  }): Effect.Effect<
    boolean,
    E | EffectErrorType<ReturnType<ProjectStore['isContentSameAtChanges']>>
  > => {
    if (!lastCommit) {
      return pipe(
        readDocumentContent({ projectId, documentId }),
        Effect.map((content) => content !== '')
      );
    }

    if (changeIdsAreSame(latestChange.id, lastCommit.id)) {
      return Effect.succeed(false);
    }

    return pipe(
      isContentSameAtChanges({
        projectId,
        documentId,
        change1: latestChange.id,
        change2: lastCommit.id,
      }),
      Effect.map((isContentSame) => !isContentSame)
    );
  };

export const getDocumentVersioningState =
  <E>({
    getDocumentHistory,
    isContentSameAtChanges,
    readDocumentContent,
  }: GetDocumentVersioningStateDeps<E>) =>
  ({ projectId, documentId }: GetDocumentVersioningStateArgs) =>
    pipe(
      // Suspended so each run issues its own read.
      Effect.suspend(() => getDocumentHistory({ projectId, documentId })),
      Effect.flatMap((historyInfo) =>
        pipe(
          hasCommittableChanges({
            isContentSameAtChanges,
            readDocumentContent,
          })({
            projectId,
            documentId,
            historyInfo,
          }),
          Effect.map((canCommit): DocumentVersioningState => ({
            history: historyInfo.history,
            canCommit,
          }))
        )
      )
    );
