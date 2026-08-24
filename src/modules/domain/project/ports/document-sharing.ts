import * as Effect from 'effect/Effect';

import {
  type ConvergentDocument,
  type UnsupportedDocumentFormatError,
  type ValidationError,
} from '../../../../modules/domain/rich-text';
import { type SharedDocumentUnavailableError } from '../errors';

// Opaque capability: holding the link is what admits a peer to the share.
export type ShareUrl = string;

export type OpenSharedDocumentError =
  | ValidationError
  | SharedDocumentUnavailableError
  | UnsupportedDocumentFormatError;

export type ShareDocumentArgs = {
  content: string;
};

export type OpenSharedDocumentArgs = {
  shareUrl: ShareUrl;
};

export type LeaveSharedDocumentArgs = {
  shareUrl: ShareUrl;
};

export type DocumentSharing = {
  shareDocument: (args: ShareDocumentArgs) => Effect.Effect<ShareUrl>;
  openSharedDocument: (
    args: OpenSharedDocumentArgs
  ) => Effect.Effect<ConvergentDocument, OpenSharedDocumentError>;
  leaveSharedDocument: (args: LeaveSharedDocumentArgs) => Effect.Effect<void>;
};
