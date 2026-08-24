import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type OpenSharedDocumentError, type ShareUrl } from '../ports';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
  type LiveDocument,
} from './live-document';

export type OpenLiveDocumentDeps = CreateLiveDocumentDeps & {
  onShareUnavailable: (error: OpenSharedDocumentError) => void;
};

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  shareUrl?: ShareUrl;
};

export const openLiveDocument =
  (deps: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
    shareUrl,
  }: OpenLiveDocumentArgs): Effect.Effect<
    LiveDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError
  > => {
    const openInitialDocument = (initialText: string) =>
      shareUrl === undefined
        ? deps.createPrivateDocument(initialText)
        : pipe(
            deps.openSharedDocument({ shareUrl }),
            // Fall back to a private document.
            Effect.catchAll((error) =>
              pipe(
                Effect.sync(() => deps.onShareUnavailable(error)),
                Effect.zipRight(deps.createPrivateDocument(initialText))
              )
            )
          );

    return pipe(
      deps.findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          openInitialDocument(artifact.content),
          Effect.flatMap((initialDocument) =>
            createLiveDocument(deps)({
              projectId,
              documentId,
              storedContent: artifact.content,
              initialDocument,
            })
          )
        )
      )
    );
  };
