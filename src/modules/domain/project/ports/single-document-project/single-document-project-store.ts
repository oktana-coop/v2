import * as Effect from 'effect/Effect';

import { type VersionControlId } from '../../../../infrastructure/version-control';
import { RepositoryError } from '../../errors';
import { type BaseArtifactMetaData } from '../../models';

export type SingleDocumentProjectStore = {
  createSingleDocumentProject: (
    documentMetaData: BaseArtifactMetaData
  ) => Effect.Effect<VersionControlId, RepositoryError, never>;
};
