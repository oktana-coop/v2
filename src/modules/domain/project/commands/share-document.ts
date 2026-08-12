import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore, type ProjectSync, type ShareUrl } from '../ports';

export type ShareDocumentError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

export type ShareDocumentDeps = {
  findDocumentById: ProjectStore['findDocumentById'];
  shareDocument: ProjectSync['shareDocument'];
};

// Shares the document as the store holds it, so callers flush what the editor
// has before sharing. Deps are read off `deps` because the sync operation
// shares this command's name.
export const shareDocument =
  (deps: ShareDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: {
    projectId: ProjectId;
    documentId: ArtifactId;
  }): Effect.Effect<ShareUrl, ShareDocumentError> =>
    pipe(
      deps.findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        deps.shareDocument({ content: artifact.content })
      )
    );
