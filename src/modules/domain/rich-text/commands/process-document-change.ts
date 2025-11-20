import * as Effect from 'effect/Effect';

import { mapErrorTo } from '../../../../utils/errors';
import { type ProjectType } from '../../../domain/project';
import {
  AccessControlError as FilesystemAccessControlError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../infrastructure/filesystem';
import {
  MigrationError,
  type ResolvedArtifactId,
} from '../../../infrastructure/version-control';
import { PRIMARY_RICH_TEXT_REPRESENTATION } from '../constants';
import {
  NotFoundError,
  RepositoryError,
  RepresentationTransformError,
  ValidationError,
} from '../errors';
import { type RichTextDocument } from '../models';
import {
  type RepresentationTransform,
  type VersionedDocumentStore,
} from '../ports';

export type ProcessDocumentChangeArgs = {
  documentId: ResolvedArtifactId;
  updatedDocument: RichTextDocument;
  writeToFileWithPath: string | null;
  projectType: ProjectType;
};

export type ProcessDocumentChangeDeps = {
  transformToText: RepresentationTransform['transformToText'];
  updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
  writeFile: Filesystem['writeFile'];
};

export const processDocumentChange =
  ({
    transformToText,
    updateRichTextDocumentContent,
  }: ProcessDocumentChangeDeps) =>
  ({
    documentId,
    updatedDocument,
    writeToFileWithPath,
  }: ProcessDocumentChangeArgs): Effect.Effect<
    void,
    | RepresentationTransformError
    | RepositoryError
    | NotFoundError
    | MigrationError
    | ValidationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('textContent', () =>
        Effect.tryPromise({
          try: async () =>
            transformToText({
              from: updatedDocument.representation,
              to: PRIMARY_RICH_TEXT_REPRESENTATION,
              input: updatedDocument.content,
            }),
          catch: mapErrorTo(
            RepresentationTransformError,
            'Rich text representation transformation error'
          ),
        })
      ),
      Effect.tap(({ textContent }) =>
        updateRichTextDocumentContent({
          documentId,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: textContent,
          writeToFileWithPath: writeToFileWithPath ?? undefined,
        })
      )
    );
