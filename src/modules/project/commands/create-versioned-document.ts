import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../../modules/version-control';
import {
  AccessControlError as FilesystemAccessControlError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import { StoreError as VersionedProjectStoreError } from '../errors';
import type { VersionedProjectStore } from '../ports/versioned-project-store';

export type CreateVersionedDocumentArgs = {
  file: File;
  projectId: VersionControlId | null;
};

export type CreateVersionedDocumentResult = {
  versionControlId: VersionControlId;
  path: string;
  name: string;
};

export type CreateVersionedDocumentDeps = {
  createDocument: VersionControlRepo['createDocument'];
  readFile: Filesystem['readFile'];
};

export const createVersionedDocument =
  ({ createDocument, readFile }: CreateVersionedDocumentDeps) =>
  ({
    file,
    projectId,
  }: CreateVersionedDocumentArgs): Effect.Effect<
    CreateVersionedDocumentResult,
    | VersionedProjectStoreError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('readFileResult', () => readFile(file.path!)),
      Effect.bind('documentId', ({ readFileResult }) =>
        createDocument({
          path: readFileResult.path!,
          name: readFileResult.name,
          title: readFileResult.name,
          content: readFileResult.content ?? null,
          projectId,
        })
      ),
      Effect.map(({ readFileResult, documentId }) => ({
        versionControlId: documentId,
        path: readFileResult.path!,
        name: readFileResult.name,
      }))
    );
