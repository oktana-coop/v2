import * as Effect from 'effect/Effect';

import {
  type ConvergentDocument,
  type SharedDocumentUnavailableError,
  type UnsupportedShareFormatError,
  type ValidationError,
} from '../../../../modules/domain/rich-text';

// Opaque capability: holding the link is what admits a peer to the share.
export type ShareUrl = string;

export type OpenSharedDocumentError =
  | ValidationError
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError;

export type ShareDocumentArgs = {
  content: string;
};

export type OpenSharedDocumentArgs = {
  shareUrl: ShareUrl;
};

export type LeaveSharedDocumentArgs = {
  shareUrl: ShareUrl;
};

export type ProjectSync = {
  shareDocument: (args: ShareDocumentArgs) => Effect.Effect<ShareUrl>;
  openSharedDocument: (
    args: OpenSharedDocumentArgs
  ) => Effect.Effect<ConvergentDocument, OpenSharedDocumentError>;
  leaveSharedDocument: (args: LeaveSharedDocumentArgs) => Effect.Effect<void>;
};
