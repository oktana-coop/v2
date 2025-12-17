import * as Effect from 'effect/Effect';

import { RepositoryError } from '../errors';

export type EncryptAndSaveToFileArgs = {
  content: string;
  fileName: string;
};

export type ReadFromFileAndDecryptArgs = {
  fileName: string;
};

export type DeleteEncryptedFileArgs = {
  fileName: string;
};

export type EncryptedStore = {
  encryptAndSaveToFile: (
    args: EncryptAndSaveToFileArgs
  ) => Effect.Effect<void, RepositoryError, never>;
  readFromFileAndDecrypt: (
    args: ReadFromFileAndDecryptArgs
  ) => Effect.Effect<string, RepositoryError, never>;
  deleteEncryptedFile: (
    args: DeleteEncryptedFileArgs
  ) => Effect.Effect<void, RepositoryError, never>;
};
