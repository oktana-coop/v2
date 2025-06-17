import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type CreateVersionedDocumentInFileArgs = {
  file: File;
  projectId: VersionControlId | null;
};

export type CreateVersionedDocumentInFileResult = {
  versionControlId: VersionControlId;
  path: string;
  name: string;
};

export type CreateVersionedDocumentInFileDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  readFile: Filesystem['readFile'];
};

export const createVersionedDocumentFromFile =
  ({
    createDocument,
    readFile,
    addDocumentToProject,
  }: CreateVersionedDocumentInFileDeps) =>
  ({
    file,
    projectId,
  }: CreateVersionedDocumentInFileArgs): Effect.Effect<
    CreateVersionedDocumentInFileResult,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('readFileResult', () => readFile(file.path!)),
      Effect.bind('documentId', ({ readFileResult }) =>
        createDocument({
          title: readFileResult.name,
          content: readFileResult.content ?? null,
        })
      ),
      Effect.tap(({ readFileResult, documentId }) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.as(undefined),
            onSome: (projId) =>
              addDocumentToProject({
                documentId,
                name: readFileResult.name,
                path: readFileResult.path!,
                projectId: projId,
              }),
          })
        )
      ),
      Effect.map(({ readFileResult, documentId }) => ({
        versionControlId: documentId,
        path: readFileResult.path!,
        name: readFileResult.name,
      }))
    );
