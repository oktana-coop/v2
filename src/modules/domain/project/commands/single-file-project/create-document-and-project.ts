import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type VersionControlId } from '../../../../infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import { RepositoryError as VersionedProjectRepositoryError } from '../../errors';
import { type SingleDocumentProjectStore } from '../../ports';

export type CreateDocumentAndProjectArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
};

export type CreateDocumentAndProjectDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'];
};

export type CreateSingleDocumentProjectResult = {
  documentId: VersionControlId;
  projectId: VersionControlId;
};

export const createDocumentAndProject =
  ({
    createDocument,
    createSingleDocumentProject,
  }: CreateDocumentAndProjectDeps) =>
  ({
    title,
    name,
    path,
    content,
  }: CreateDocumentAndProjectArgs): Effect.Effect<
    CreateSingleDocumentProjectResult,
    VersionedProjectRepositoryError | VersionedDocumentRepositoryError,
    never
  > =>
    pipe(
      createDocument({
        title,
        content,
      }),
      Effect.flatMap((documentId) =>
        pipe(
          createSingleDocumentProject({
            versionControlId: documentId,
            name,
            path,
          }),
          Effect.map((projectId) => ({ documentId, projectId }))
        )
      )
    );
