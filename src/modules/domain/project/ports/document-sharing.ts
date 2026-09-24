import * as Effect from 'effect/Effect';

import {
  type ConvergentDocument,
  type ConvergentDocumentVersion,
  type UnsupportedDocumentFormatError,
  type ValidationError,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import { type SharedDocumentUnavailableError } from '../errors';

// Opaque capability: holding the link is what admits a peer to the share.
export type ShareId = string;

export type OpenedSharedDocument = {
  document: ConvergentDocument;
  // The version this app last held the document at, when it was found
  // locally. Null when this app has no record of holding it.
  baseVersion: ConvergentDocumentVersion | null;
};

export type OpenSharedDocumentError =
  | ValidationError
  | SharedDocumentUnavailableError
  | UnsupportedDocumentFormatError;

export type SharedDocumentIdentity = {
  branch: Branch;
  documentId: ArtifactId;
};

export type SharedDocumentInfo = SharedDocumentIdentity & {
  name: string;
};

export type ShareDocumentArgs = SharedDocumentInfo & {
  content: string;
};

export type OpenSharedDocumentArgs = {
  shareId: ShareId;
};

export type GetSharedDocumentInfoArgs = {
  shareId: ShareId;
};

export type LeaveSharedDocumentArgs = {
  shareId: ShareId;
};

export type DocumentSharing = {
  shareDocument: (
    args: ShareDocumentArgs
  ) => Effect.Effect<ShareId, SharedDocumentUnavailableError>;
  openSharedDocument: (
    args: OpenSharedDocumentArgs
  ) => Effect.Effect<OpenedSharedDocument, OpenSharedDocumentError>;
  getSharedDocumentInfo: (
    args: GetSharedDocumentInfoArgs
  ) => Effect.Effect<SharedDocumentInfo, OpenSharedDocumentError>;
  leaveSharedDocument: (
    args: LeaveSharedDocumentArgs
  ) => Effect.Effect<void, SharedDocumentUnavailableError>;
};
