import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type Filesystem } from '../../../../modules/infrastructure/filesystem';
import { type VersionedArtifactHandleChangePayload } from '../../../../modules/infrastructure/version-control';
import { type RichTextDocument, type VersionedDocumentHandle } from '../models';
import { type VersionedDocumentStore } from '../ports';

export type RegisterLiveUpdateArgs = {
  documentHandle: VersionedDocumentHandle;
  filePath: string;
};

export type RegisterLiveUpdatesDeps = {
  getRichTextDocumentContent: VersionedDocumentStore['getRichTextDocumentContent'];
  findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
  writeFile: Filesystem['writeFile'];
};

export type RegisterLiveUpdatesResponse = {
  registeredListener: (
    changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
  ) => Promise<void>;
};

export const registerLiveUpdates =
  ({ writeFile, getRichTextDocumentContent }: RegisterLiveUpdatesDeps) =>
  async ({
    documentHandle,
    filePath,
  }: RegisterLiveUpdateArgs): Promise<RegisterLiveUpdatesResponse> => {
    if (!documentHandle) {
      throw new Error(
        'No document handle found in repository for the selected document'
      );
    }

    const propagateChangesToFile = async (
      changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
    ) => {
      try {
        // TODO: Assess if we need to await this effect
        Effect.runPromise(
          pipe(
            getRichTextDocumentContent(changePayload.doc),
            Effect.flatMap((newContent) => writeFile(filePath, newContent))
          )
        );
      } catch (error) {
        console.error('Error writing file:', error);
      }
    };

    documentHandle.on('change', propagateChangesToFile);

    return {
      registeredListener: propagateChangesToFile,
    };
  };
