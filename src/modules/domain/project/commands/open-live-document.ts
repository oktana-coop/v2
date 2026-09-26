import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type OpenSharedDocumentError, type ShareId } from '../ports';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
  type StoredLiveDocument,
  withStoredCopy,
  type WithStoredCopyDeps,
} from './live-document';

export type OpenLiveDocumentDeps = CreateLiveDocumentDeps &
  WithStoredCopyDeps & {
    onShareUnavailable: (error: OpenSharedDocumentError) => void;
  };

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  shareId?: ShareId;
};

export const openLiveDocument =
  (deps: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
    shareId,
  }: OpenLiveDocumentArgs): Effect.Effect<
    StoredLiveDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError
  > => {
    const openInitialDocument = (initialText: string) =>
      shareId === undefined
        ? deps.createPrivateDocument(initialText)
        : pipe(
            deps.openSharedDocument({ shareId }),
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
            createLiveDocument(deps)({ documentId, initialDocument })
          ),
          Effect.flatMap(
            withStoredCopy(deps)({
              projectId,
              documentId,
              storedContent: artifact.content,
            })
          )
        )
      )
    );
  };
