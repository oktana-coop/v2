import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { RepositoryError } from '../../errors';
import { removeFile, stageFile } from '../staging-area';
import { type IsoGitDeps } from '../types';

export type RenameFileArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  oldPath: string;
  newPath: string;
};

export const renameFile = ({
  isoGitFs,
  dir,
  oldPath,
  newPath,
}: RenameFileArgs): Effect.Effect<void, RepositoryError, never> =>
  pipe(
    removeFile({ isoGitFs, dir, path: oldPath }),
    Effect.flatMap(() => stageFile({ isoGitFs, dir, path: newPath }))
  );
