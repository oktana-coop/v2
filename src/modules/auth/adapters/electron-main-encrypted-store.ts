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

  const getAbsoluteFilePath: (
    relativePath: string
  ) => Effect.Effect<string, RepositoryError, never> = (relativePath: string) =>
    pipe(
      getStorageDir(),
      Effect.flatMap((dirPath) =>
        pipe(
          filesystem.getAbsolutePath({ path: relativePath, dirPath }),
          Effect.catchAll((err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const encryptAndSaveToFile: EncryptedStore['encryptAndSaveToFile'] = ({
    content,
    fileName,
  }) =>
    Effect.Do.pipe(
      Effect.bind('path', () => getAbsoluteFilePath(fileName)),
      Effect.bind('encryptedContent', () =>
        pipe(
          safeStorage.isEncryptionAvailable()
            ? Effect.try({
                try: () => safeStorage.encryptString(content),
                catch: mapErrorTo(
                  RepositoryError,
                  'Cannot encrypt file content to store it in the encrypted storage.'
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

  const readFromFileAndDecrypt: EncryptedStore['readFromFileAndDecrypt'] = ({
    fileName,
  }) =>
    pipe(
      getAbsoluteFilePath(fileName),
      Effect.flatMap((path) =>
        pipe(
          filesystem.readBinaryFile(path),
          Effect.catchAll((err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      ),
      Effect.flatMap(({ content }) =>
        Effect.try({
          try: () =>
            safeStorage.decryptString(
              Buffer.isBuffer(content) ? content : Buffer.from(content)
            ),
          catch: mapErrorTo(
            RepositoryError,
            'Cannot decrypt encrypted storage file content.'
          ),
        })
      )
    );

  const deleteEncryptedFile: EncryptedStore['deleteEncryptedFile'] = ({
    fileName,
  }) =>
    pipe(
      getAbsoluteFilePath(fileName),
      Effect.flatMap((path) =>
        pipe(
          filesystem.deleteFile(path),
          Effect.catchAll((err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  return {
    encryptAndSaveToFile,
    readFromFileAndDecrypt,
    deleteEncryptedFile,
  };
};
