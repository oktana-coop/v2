import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type AlreadyExistsError } from '../../../../modules/infrastructure/filesystem';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import {
  type NotFoundError,
  type RepositoryError,
  type ValidationError,
} from '../errors';
import {
  parseDocumentNameEffect,
  type ProjectId,
  type ProjectRelPath,
} from '../models';
import { type ProjectStore } from '../ports';

export type CreateDocumentInProjectArgs = {
  projectId: ProjectId;
  parentDirectoryPath: ProjectRelPath | undefined;
  name: string;
};

export type CreateDocumentInProjectDeps = {
  createDocument: ProjectStore['createDocument'];
};

export const createDocumentInProject =
  ({ createDocument }: CreateDocumentInProjectDeps) =>
  ({
    projectId,
    parentDirectoryPath,
    name,
  }: CreateDocumentInProjectArgs): Effect.Effect<
    ArtifactId,
    AlreadyExistsError | ValidationError | RepositoryError | NotFoundError,
    never
  > =>
    pipe(
      parseDocumentNameEffect(name),
      Effect.flatMap((documentName) =>
        createDocument({ projectId, parentDirectoryPath, name: documentName })
      )
    );
