import * as Effect from 'effect/Effect';

import { type File } from '../../../../../modules/infrastructure/filesystem';
import {
  MigrationError,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type SingleDocumentProjectStore } from '../../ports/single-document-project';

export type GetProjectNameArgs = {
  projectId: VersionControlId;
  projectFile?: File;
};

export type GetProjectNameDeps = {
  getProjectNameFromStore: SingleDocumentProjectStore['getProjectName'];
};

export const getProjectName =
  ({ getProjectNameFromStore }: GetProjectNameDeps) =>
  ({
    projectId,
    projectFile,
  }: GetProjectNameArgs): Effect.Effect<
    string | null,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | MigrationError,
    never
  > =>
    projectFile
      ? Effect.succeed(projectFile.name)
      : getProjectNameFromStore(projectId);
