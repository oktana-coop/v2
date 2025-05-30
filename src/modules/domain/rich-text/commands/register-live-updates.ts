import * as Effect from 'effect/Effect';

import { type Filesystem } from '../../../../modules/infrastructure/filesystem';
import {
  type VersionControlId,
  type VersionedArtifactHandleChangePayload,
} from '../../../../modules/infrastructure/version-control';
import {
  convertToStorageFormat,
  type RichTextDocument,
  type VersionedDocumentHandle,
} from '../models';
import { type VersionedDocumentStore } from '../ports';

export type RegisterLiveUpdateArgs = {
  documentId: VersionControlId;
  filePath: string;
};

export type RegisterLiveUpdatesDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  writeFile: Filesystem['writeFile'];
};

export type RegisterLiveUpdatesResponse = {
  documentHandle: VersionedDocumentHandle;
  registeredListener: (
    changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
  ) => Promise<void>;
};

export const registerLiveUpdates =
  ({ findDocumentById, writeFile }: RegisterLiveUpdatesDeps) =>
  async ({
    documentId,
    filePath,
  }: RegisterLiveUpdateArgs): Promise<RegisterLiveUpdatesResponse> => {
    const documentHandle = await Effect.runPromise(
      findDocumentById(documentId)
    );

    if (!documentHandle) {
      throw new Error(
        'No document handle found in repository for the selected document'
      );
    }

    const propagateChangesToFile = async (
      changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
    ) => {
      // TODO: Assess if we need to await this effect
      writeFile(filePath, convertToStorageFormat(changePayload.doc));
    };

    documentHandle.on('change', propagateChangesToFile);

    return {
      documentHandle,
      registeredListener: propagateChangesToFile,
    };
  };
