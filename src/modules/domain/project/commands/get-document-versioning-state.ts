import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { isEmpty } from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Change,
  changeIdsAreSame,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../models';
import { type GetDocumentHistoryResponse, type ProjectStore } from '../ports';

export type DocumentVersioningState = {
  history: Change[];
  canCommit: boolean;
};

export type GetDocumentVersioningStateDeps = {
  getDocumentHistory: ProjectStore['getDocumentHistory'];
  isContentSameAtChanges: ProjectStore['isContentSameAtChanges'];
};

export type GetDocumentVersioningStateArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

const hasCommittableChanges =
  ({
    isContentSameAtChanges,
  }: Pick<GetDocumentVersioningStateDeps, 'isContentSameAtChanges'>) =>
  ({
    projectId,
    documentId,
    historyInfo: { current, latestChange, lastCommit },
  }: GetDocumentVersioningStateArgs & {
    historyInfo: GetDocumentHistoryResponse;
  }) => {
    if (!lastCommit) return Effect.succeed(!isEmpty(current));

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
  ({
    getDocumentHistory,
    isContentSameAtChanges,
  }: GetDocumentVersioningStateDeps) =>
  ({ projectId, documentId }: GetDocumentVersioningStateArgs) =>
    pipe(
      // Suspended so each run issues its own read.
      Effect.suspend(() => getDocumentHistory({ projectId, documentId })),
      Effect.flatMap((historyInfo) =>
        pipe(
          hasCommittableChanges({ isContentSameAtChanges })({
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
