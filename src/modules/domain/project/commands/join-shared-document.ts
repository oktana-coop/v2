import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  type Branch,
  type MigrationError,
} from '../../../../modules/infrastructure/version-control';
import {
  type NotFoundError,
  type RepositoryError,
  SharedDocumentNotInProjectError,
  SharedDocumentOnAnotherBranchError,
  type ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type ProjectId } from '../models';
import {
  type DocumentSharing,
  type OpenSharedDocumentError,
  type ProjectStore,
  type ShareUrl,
} from '../ports';
import { type LiveDocument } from './live-document';

export type JoinSharedDocumentDeps = {
  getSharedDocumentIdentity: DocumentSharing['getSharedDocumentIdentity'];
  findDocumentById: ProjectStore['findDocumentById'];
  rememberShare: (args: { documentId: ArtifactId; shareUrl: ShareUrl }) => void;
  openDocument: Pick<LiveDocument, 'documentId' | 'attachTo'> | null;
};

export type JoinSharedDocumentResult = {
  documentId: ArtifactId;
  attached: boolean;
};

export type JoinSharedDocumentArgs = {
  shareUrl: ShareUrl;
  projectId: ProjectId;
  branch: Branch;
};

export type JoinSharedDocumentError =
  | OpenSharedDocumentError
  | SharedDocumentOnAnotherBranchError
  | SharedDocumentNotInProjectError
  | RepositoryError
  | ValidationError
  | NotFoundError
  | MigrationError;

export const joinSharedDocument =
  ({
    getSharedDocumentIdentity,
    findDocumentById,
    rememberShare,
    openDocument,
  }: JoinSharedDocumentDeps) =>
  ({
    shareUrl,
    projectId,
    branch,
  }: JoinSharedDocumentArgs): Effect.Effect<
    JoinSharedDocumentResult,
    JoinSharedDocumentError
  > => {
    const attachIfOpen = (documentId: ArtifactId) =>
      openDocument && openDocument.documentId === documentId
        ? pipe(openDocument.attachTo(shareUrl), Effect.as(true))
        : Effect.succeed(false);

    return pipe(
      getSharedDocumentIdentity({ shareUrl }),
      Effect.flatMap((sharedDocIdentity) =>
        sharedDocIdentity.branch === branch
          ? Effect.succeed(sharedDocIdentity.documentId)
          : Effect.fail(
              new SharedDocumentOnAnotherBranchError(
                `The share belongs to branch "${sharedDocIdentity.branch}"; this project is on "${branch}".`
              )
            )
      ),
      Effect.tap((documentId) =>
        pipe(
          findDocumentById({ projectId, documentId }),
          Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
            Effect.fail(
              new SharedDocumentNotInProjectError(
                'The share belongs to a document this project does not have.'
              )
            )
          )
        )
      ),
      Effect.flatMap((documentId) =>
        pipe(
          attachIfOpen(documentId),
          Effect.map((attached) => ({ documentId, attached }))
        )
      ),
      Effect.tap(({ documentId }) =>
        Effect.sync(() => rememberShare({ documentId, shareUrl }))
      )
    );
  };
