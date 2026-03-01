import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  DataIntegrityError as VersionedProjectDataIntegrityError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type ResolvedDocument,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type CreateVersionedDocumentInFileArgs = {
  file: File;
  projectId: ProjectId | null;
};

export type CreateVersionedDocumentInFileResult = {
  id: ResolvedDocument['id'];
  path: string;
  name: string;
};

export type CreateVersionedDocumentInFileDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  readTextFile: Filesystem['readTextFile'];
};

export const createVersionedDocumentFromFile =
  ({
    createDocument,
    readTextFile,
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
    | VersionedDocumentValidationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('readTextFileResult', () => readTextFile(file.path)),
      Effect.bind('documentId', ({ readTextFileResult }) =>
        createDocument({
          content: readTextFileResult.content ?? null,
        })
      ),
      Effect.tap(({ documentId }) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.as(undefined),
            onSome: (projId) =>
              addDocumentToProject({
                documentId,
                name: file.name,
                path: file.path,
                projectId: projId,
              }),
          })
        )
      ),
      Effect.map(({ documentId }) => ({
        id: documentId,
        path: file.path,
        name: file.name,
      }))
    );
