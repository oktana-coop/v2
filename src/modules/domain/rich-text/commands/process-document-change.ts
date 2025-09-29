import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { fromNullable } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import { type ProjectType, projectTypes } from '../../../domain/project';
import {
  AccessControlError as FilesystemAccessControlError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../infrastructure/filesystem';
import { richTextRepresentations } from '../constants';
import {
  RepositoryError,
  RepresentationTransformError,
  ValidationError,
} from '../errors';
import { type RichTextDocument, VersionedDocumentHandle } from '../models';
import {
  type RepresentationTransform,
  type VersionedDocumentStore,
} from '../ports';

export type ProcessDocumentChangeArgs = {
  document: RichTextDocument;
  documentHandle: VersionedDocumentHandle;
  filePath: string | null;
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
    writeFile,
  }: ProcessDocumentChangeDeps) =>
  ({
    document,
    // TODO: Remove dependency to doc handle
    documentHandle,
    filePath,
    projectType,
  }: ProcessDocumentChangeArgs): Effect.Effect<
    void,
    | RepresentationTransformError
    | RepositoryError
    | ValidationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      Effect.tryPromise({
        try: async () =>
          transformToText({
            from: document.representation,
            to: richTextRepresentations.AUTOMERGE,
            input: document.content,
          }),
        catch: mapErrorTo(
          RepresentationTransformError,
          'Rich text representation transformation error'
        ),
      }),
      Effect.tap((automergeSpansStr) =>
        updateRichTextDocumentContent({
          documentHandle,
          representation: richTextRepresentations.AUTOMERGE,
          content: automergeSpansStr,
        })
      ),
      Effect.flatMap((automergeSpansStr) =>
        projectType === projectTypes.MULTI_DOCUMENT_PROJECT
          ? pipe(
              fromNullable(
                filePath,
                () =>
                  new ValidationError(
                    'File path not provided; cannot write to document file'
                  )
              ),
              Effect.flatMap((path) => writeFile(path, automergeSpansStr))
            )
          : Effect.succeed(undefined)
      )
    );
