import * as Effect from 'effect/Effect';

import { type VersionedDocumentHandle } from '../../rich-text';
import { type VersionControlId } from '../../version-control';
import { NotFoundError, RepositoryError } from '../errors';
import type {
  DocumentMetaData,
  Project,
  VersionedProject,
  VersionedProjectHandle,
} from '../models';

export type CreateProjectArgs = {
  path: string;
  documents: Project['documents'];
};

export type CreateDocumentArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
  projectId: VersionControlId | null;
};

export type DeleteDocumentFromProjectArgs = {
  projectId: VersionControlId;
  documentId: VersionControlId;
};

export type FindDocumentInProjectArgs = {
  projectId: VersionControlId;
  documentPath: string;
};

export type VersionedProjectStore = {
  createProject: (
    args: CreateProjectArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  findProjectById: (
    id: VersionControlId
  ) => Effect.Effect<
    VersionedProjectHandle,
    RepositoryError | NotFoundError,
    never
  >;
  listProjectDocuments: (
    id: VersionControlId
  ) => Effect.Effect<
    DocumentMetaData[],
    RepositoryError | NotFoundError,
    never
  >;
  createDocument: (
    args: CreateDocumentArgs
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
  deleteDocumentFromProject: (
    args: DeleteDocumentFromProjectArgs
  ) => Effect.Effect<void, RepositoryError | NotFoundError, never>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Effect.Effect<
    VersionedDocumentHandle,
    RepositoryError | NotFoundError,
    never
  >;
  getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<VersionedProject, RepositoryError | NotFoundError, never>;
};
