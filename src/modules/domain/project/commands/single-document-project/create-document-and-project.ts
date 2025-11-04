import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ResolvedArtifactId } from '../../../../infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import { RepositoryError as VersionedProjectRepositoryError } from '../../errors';
import { ProjectId } from '../../models';
import { type SingleDocumentProjectStore } from '../../ports';

export type CreateDocumentAndProjectArgs = {
  name?: string;
  content: string | null;
};

export type CreateDocumentAndProjectDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'];
};

export type CreateSingleDocumentProjectResult = {
  documentId: ResolvedArtifactId;
  projectId: ProjectId;
};

export const createDocumentAndProject =
  ({
    createDocument,
    createSingleDocumentProject,
  }: CreateDocumentAndProjectDeps) =>
  ({
    name,
    content,
  }: CreateDocumentAndProjectArgs): Effect.Effect<
    CreateSingleDocumentProjectResult,
    | VersionedProjectRepositoryError
    | VersionedDocumentRepositoryError
    | VersionedDocumentValidationError,
    never
  > =>
    pipe(
      createDocument({
        content,
      }),
      Effect.flatMap((documentId) =>
        pipe(
          createSingleDocumentProject({
            documentMetaData: { id: documentId },
            name: name ?? null,
          }),
          Effect.map((projectId) => ({ documentId, projectId }))
        )
      )
    );
