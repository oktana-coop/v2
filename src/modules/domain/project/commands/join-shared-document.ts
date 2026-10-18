import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  type Branch,
  type MigrationError,
} from '../../../../modules/infrastructure/version-control';
import {
  type DocumentSharing,
  type EditableLiveDocument,
  type LocalEditsContributionError,
  type OpenSharedDocumentError,
  type SharedDocumentInfo,
  type SharedDocumentResolver,
  type ShareId,
} from '../../collaboration';
import {
  type NotFoundError,
  type RepositoryError,
  SharedDocumentNotInProjectError,
  SharedDocumentOnAnotherBranchError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type DocumentKind, isDocumentKind, type ProjectId } from '../models';
import { type ProjectStore, type ShareRegistry } from '../ports';

export type JoinSharedDocumentDeps = {
  getSharedDocumentKind: SharedDocumentResolver['getSharedDocumentKind'];
  getArtifactMetaDataById: ProjectStore['getArtifactMetaDataById'];
  getSharedDocumentInfo: Record<
    DocumentKind,
    DocumentSharing['getSharedDocumentInfo']
  >;
  lookupArtifactInProject: ProjectStore['lookupArtifactInProject'];
  rememberShare: ShareRegistry['rememberShare'];
  openDocument: Pick<EditableLiveDocument, 'documentId' | 'attachTo'> | null;
};

export type JoinSharedDocumentResult = {
  documentId: ArtifactId;
  attached: boolean;
};

export type JoinSharedDocumentArgs = {
  shareId: ShareId;
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
  | MigrationError
  | LocalEditsContributionError;

export const joinSharedDocument =
  ({
    getSharedDocumentKind,
    getArtifactMetaDataById,
    getSharedDocumentInfo,
    lookupArtifactInProject,
    rememberShare,
    openDocument,
  }: JoinSharedDocumentDeps) =>
  ({
    shareId,
    projectId,
    branch,
  }: JoinSharedDocumentArgs): Effect.Effect<
    JoinSharedDocumentResult,
    JoinSharedDocumentError
  > => {
    const attachIfOpen = (documentId: ArtifactId) =>
      openDocument && openDocument.documentId === documentId
        ? pipe(openDocument.attachTo(shareId), Effect.as(true))
        : Effect.succeed(false);

    const readSharedDocumentInfo = pipe(
      getSharedDocumentKind({ shareId }),
      Effect.flatMap(
        (
          kind
        ): Effect.Effect<
          SharedDocumentInfo,
          OpenSharedDocumentError | ValidationError
        > =>
          isDocumentKind(kind)
            ? getSharedDocumentInfo[kind]({ shareId })
            : Effect.fail(
                new ValidationError('The share is not of a document.')
              )
      )
    );

    const findInProject = (documentId: ArtifactId) =>
      pipe(
        getArtifactMetaDataById({ projectId, artifactId: documentId }),
        Effect.flatMap(({ path }) =>
          lookupArtifactInProject({ projectId, path })
        ),
        Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
          Effect.fail(
            new SharedDocumentNotInProjectError(
              'The share belongs to a document this project does not have.'
            )
          )
        )
      );

    return pipe(
      readSharedDocumentInfo,
      Effect.flatMap((sharedDocInfo) =>
        sharedDocInfo.branch === branch
          ? Effect.succeed(sharedDocInfo)
          : Effect.fail(
              new SharedDocumentOnAnotherBranchError(
                `The share belongs to branch "${sharedDocInfo.branch}"; this project is on "${branch}".`,
                { branch: sharedDocInfo.branch }
              )
            )
      ),
      Effect.tap(({ documentId }) => findInProject(documentId)),
      Effect.flatMap(({ documentId }) =>
        pipe(
          attachIfOpen(documentId),
          Effect.map((attached) => ({ documentId, attached }))
        )
      ),
      Effect.tap(({ documentId }) =>
        Effect.sync(() =>
          rememberShare({ key: { projectId, branch, documentId }, shareId })
        )
      )
    );
  };
