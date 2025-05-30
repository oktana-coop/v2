import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../errors';
import { type ArtifactMetaData, type SingleDocumentProject } from '../models';

export type CreateSingleDocumentProjectArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
};

export type SingleDocumentProjectStore = {
  createSingleDocumentProject: (
    document: ArtifactMetaData
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
};
