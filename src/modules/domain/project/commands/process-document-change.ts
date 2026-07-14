import * as Effect from 'effect/Effect';

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

export type ProcessDocumentChangeArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  updatedDocument: RichTextDocument;
};

export type ProcessDocumentChangeDeps = {
  transformToText: RepresentationTransform['transformToText'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
};

export const processDocumentChange =
  ({
    transformToText,
    updateRichTextDocumentContent,
  }: ProcessDocumentChangeDeps) =>
  ({
    projectId,
    documentId,
    updatedDocument,
  }: ProcessDocumentChangeArgs): Effect.Effect<
    void,
    | ValidationError
    | RepositoryError
    | NotFoundError
    | MigrationError
    | RepresentationTransformError,
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
          projectId,
          documentId,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: textContent,
        })
      )
    );
