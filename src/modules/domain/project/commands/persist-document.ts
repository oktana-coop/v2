import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RepresentationTransform,
  RepresentationTransformError,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../utils/errors';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';

export type PersistDocumentError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError
  | RepresentationTransformError;

export type PersistDocumentDeps = {
  transformToText: RepresentationTransform['transformToText'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
};

export type PersistDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  document: RichTextDocument;
  // When the document's primary-text content equals this, the write is skipped.
  skipIfContentEquals?: string;
};

const toPrimaryTextRepresentation =
  (transformToText: RepresentationTransform['transformToText']) =>
  (
    document: RichTextDocument
  ): Effect.Effect<string, RepresentationTransformError> =>
    document.representation === PRIMARY_RICH_TEXT_REPRESENTATION
      ? Effect.succeed(document.content)
      : Effect.tryPromise({
          try: () =>
            transformToText({
              from: document.representation,
              to: PRIMARY_RICH_TEXT_REPRESENTATION,
              input: document.content,
            }),
          catch: mapErrorTo(
            RepresentationTransformError,
            'Rich text representation transformation error'
          ),
        });

// Writes the document to the store in the primary text representation,
// transforming it first when needed. Returns the primary-text content the
// store holds afterwards.
export const persistDocument =
  ({ transformToText, updateRichTextDocumentContent }: PersistDocumentDeps) =>
  ({
    projectId,
    documentId,
    document,
    skipIfContentEquals,
  }: PersistDocumentArgs): Effect.Effect<string, PersistDocumentError> =>
    pipe(
      toPrimaryTextRepresentation(transformToText)(document),
      Effect.tap((textContent) =>
        textContent === skipIfContentEquals
          ? Effect.void
          : updateRichTextDocumentContent({
              projectId,
              documentId,
              representation: PRIMARY_RICH_TEXT_REPRESENTATION,
              content: textContent,
            })
      )
    );
