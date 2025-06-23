import { type Filesystem } from '../../../../modules/infrastructure/filesystem';
import { type VersionedArtifactHandleChangePayload } from '../../../../modules/infrastructure/version-control';
import {
  convertToStorageFormat,
  type RichTextDocument,
  type VersionedDocumentHandle,
} from '../models';
import { type VersionedDocumentStore } from '../ports';

export type RegisterLiveUpdateArgs = {
  documentHandle: VersionedDocumentHandle;
  filePath: string;
};

export type RegisterLiveUpdatesDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  writeFile: Filesystem['writeFile'];
};

export type RegisterLiveUpdatesResponse = {
  registeredListener: (
    changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
  ) => Promise<void>;
};

export const registerLiveUpdates =
  ({ writeFile }: RegisterLiveUpdatesDeps) =>
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
        writeFile(filePath, convertToStorageFormat(changePayload.doc));
      } catch (error) {
        console.error('Error writing file:', error);
      }
    };

    documentHandle.on('change', propagateChangesToFile);

    return {
      registeredListener: propagateChangesToFile,
    };
  };
