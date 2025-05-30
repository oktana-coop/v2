import { type VersionedArtifactHandleChangePayload } from '../../../../modules/infrastructure/version-control';
import { type RichTextDocument, type VersionedDocumentHandle } from '../models';

export type UnregisterLiveUpdatesArgs = {
  documentHandle: VersionedDocumentHandle;
  registeredListener: (
    changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
  ) => void;
};

export const unregisterLiveUpdates = ({
  documentHandle,
  registeredListener,
}: UnregisterLiveUpdatesArgs) => {
  documentHandle.off('change', registeredListener);
};
