import * as Effect from 'effect/Effect';

import {
  AccessControlError as FilesystemAccessControlError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import { RepositoryError as VersionControlRepositoryError } from '../errors';
import type { VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';

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
    | VersionControlRepositoryError
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
