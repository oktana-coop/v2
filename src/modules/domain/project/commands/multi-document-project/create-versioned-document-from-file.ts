import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  DataIntegrityError as VersionedProjectDataIntegrityError,
  type File,
  type Filesystem,
  isTextFile,
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
  id: VersionControlId;
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
    | VersionedProjectDataIntegrityError
    | VersionedDocumentRepositoryError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('readFileResult', () =>
        pipe(
          readFile(file.path),
          Effect.flatMap((file) =>
            isTextFile(file)
              ? Effect.succeed(file)
              : Effect.fail(
                  new FilesystemDataIntegrityError(
                    'Expected a text file but got a binary'
                  )
                )
          )
        )
      ),
      Effect.bind('documentId', ({ readFileResult }) =>
        createDocument({
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
                path: readFileResult.path,
                projectId: projId,
              }),
          })
        )
      ),
      Effect.map(({ readFileResult, documentId }) => ({
        id: documentId,
        path: readFileResult.path,
        name: readFileResult.name,
      }))
    );
