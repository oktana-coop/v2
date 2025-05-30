import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { RepositoryError } from '../../errors';
import { type SingleDocumentProject } from '../../models';
import { type SingleDocumentProjectStore } from '../../ports';

export const createAdapter = (
  automergeRepo: Repo
): SingleDocumentProjectStore => {
  const createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'] =
    (documentMetaData) =>
      pipe(
        Effect.try({
          try: () =>
            automergeRepo.create<SingleDocumentProject>({
              document: documentMetaData,
              assets: {},
            }),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        }),
        Effect.map((handle) => handle.url)
      );

  return {
    createSingleDocumentProject,
  };
};
