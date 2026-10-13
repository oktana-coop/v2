import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { artifactKinds, type DocumentKind, type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { type StoredContentReadError } from './live-document';

export type ReadDocumentContentDeps = {
  findRichTextDocumentById: ProjectStore['findRichTextDocumentById'];
  findPlainTextDocumentById: ProjectStore['findPlainTextDocumentById'];
};

export type ReadDocumentContentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export const readDocumentContent =
  ({
    findRichTextDocumentById,
    findPlainTextDocumentById,
  }: ReadDocumentContentDeps) =>
  (kind: DocumentKind) =>
  (
    args: ReadDocumentContentArgs
  ): Effect.Effect<string, StoredContentReadError> =>
    kind === artifactKinds.RICH_TEXT_DOCUMENT
      ? pipe(
          findRichTextDocumentById(args),
          Effect.map(({ artifact }) => artifact.content)
        )
      : pipe(
          findPlainTextDocumentById(args),
          Effect.map(({ content }) => content)
        );
