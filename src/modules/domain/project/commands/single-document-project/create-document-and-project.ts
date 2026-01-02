import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type Email, type Username } from '../../../../auth';
import {
  type Branch,
  DEFAULT_BRANCH,
  type ResolvedArtifactId,
} from '../../../../infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import { RepositoryError as VersionedProjectRepositoryError } from '../../errors';
import { ProjectId } from '../../models';
import { type SingleDocumentProjectStore } from '../../ports';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type CreateDocumentAndProjectArgs = {
  name?: string;
  content: string | null;
  writeToFileWithPath?: string;
  cloneUrl?: string;
} & UserInfo;

export type CreateDocumentAndProjectDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'];
  getCurrentBranch: SingleDocumentProjectStore['getCurrentBranch'];
};

export type CreateSingleDocumentProjectResult = {
  documentId: ResolvedArtifactId;
  projectId: ProjectId;
  currentBranch: Branch;
};

export const createDocumentAndProject =
  ({
    createDocument,
    createSingleDocumentProject,
    getCurrentBranch,
  }: CreateDocumentAndProjectDeps) =>
  ({
    name,
    content,
    writeToFileWithPath,
    username,
    email,
    cloneUrl,
  }: CreateDocumentAndProjectArgs): Effect.Effect<
    CreateSingleDocumentProjectResult,
    | VersionedProjectRepositoryError
    | VersionedDocumentRepositoryError
    | VersionedDocumentValidationError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('documentId', () =>
        createDocument({
          content,
          filePath: writeToFileWithPath,
          writeToFile: Boolean(writeToFileWithPath),
          branch: DEFAULT_BRANCH as Branch,
        })
      ),
      Effect.bind('projectId', ({ documentId }) =>
        createSingleDocumentProject({
          documentMetaData: { id: documentId },
          name: name ?? null,
          username,
          email,
          cloneUrl,
        })
      ),
      Effect.flatMap(({ documentId, projectId }) =>
        pipe(
          getCurrentBranch({ projectId }),
          // We shouldn't be getting validation or not-found error since we just created the project.
          // If something is wrong here, from the perspective of the command we consider it a repository error.
          Effect.catchAll(() =>
            Effect.fail(new VersionedProjectRepositoryError('Git repo error'))
          ),
          Effect.map((currentBranch) => ({
            projectId,
            documentId,
            currentBranch,
          }))
        )
      )
    );
