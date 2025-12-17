import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { app } from 'electron';
import { safeStorage } from 'electron';

import { mapErrorTo } from '../../../utils/errors';
import { Filesystem } from '../../infrastructure/filesystem';
import { RepositoryError } from '../errors';
import { EncryptedStore } from '../ports/encrypted-store';

const STORAGE_DIR_NAME = 'userData';

export const createAdapter = ({
  filesystem,
}: {
  filesystem: Filesystem;
}): EncryptedStore => {
  const getStorageDir: () => Effect.Effect<
    string,
    RepositoryError,
    never
  > = () =>
    Effect.try({
      try: () => app.getPath(STORAGE_DIR_NAME),
      catch: mapErrorTo(
        RepositoryError,
        'Cannot create the Git blob ref for the document'
      ),
    });

  const encryptAndSaveToFile: EncryptedStore['encryptAndSaveToFile'] = ({
    content,
    fileName,
  }) =>
    Effect.Do.pipe(
      Effect.bind('path', () =>
        pipe(
          getStorageDir(),
          Effect.flatMap((dirPath) =>
            pipe(
              filesystem.getAbsolutePath({ path: fileName, dirPath }),
              Effect.catchAll((err) =>
                Effect.fail(new RepositoryError(err.message))
              )
            )
          )
        )
      ),
      Effect.bind('encryptedContent', () =>
        pipe(
          safeStorage.isEncryptionAvailable()
            ? Effect.try({
                try: () => safeStorage.encryptString(content),
                catch: mapErrorTo(
                  RepositoryError,
                  'Cannot create the Git blob ref for the document'
                ),
              })
            : Effect.fail(
                new RepositoryError('Encrypted storage is not available.')
              )
        )
      ),
      Effect.flatMap(({ path, encryptedContent }) =>
        pipe(
          filesystem.writeFile({ path, content: encryptedContent }),
          Effect.catchAll((err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  return {
    encryptAndSaveToFile,
  };
};
