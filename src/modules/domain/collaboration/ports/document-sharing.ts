import * as Effect from 'effect/Effect';

import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  type SharedDocumentUnavailableError,
  type UnsupportedDocumentFormatError,
  type ValidationError,
} from '../errors';
import { type ShareId } from '../models';
import { type ConvergentDocument } from './convergent-document';

// The share could not be reached, or what it holds is not a document of the
// kind expected.
export type OpenSharedDocumentError =
  | SharedDocumentUnavailableError
  | UnsupportedDocumentFormatError
  | ValidationError;

export type SharedDocumentIdentity = {
  branch: Branch;
  documentId: ArtifactId;
};

export type SharedDocumentInfo = SharedDocumentIdentity & {
  name: string;
};

export type ShareDocumentArgs<DocumentType> = SharedDocumentInfo & {
  doc: DocumentType;
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

export type DocumentSharing<
  DocumentType = unknown,
  ParticipantSelectionType = unknown,
> = {
  shareDocument: (
    args: ShareDocumentArgs<DocumentType>
  ) => Effect.Effect<ShareId, SharedDocumentUnavailableError>;
  openSharedDocument: (
    args: OpenSharedDocumentArgs
  ) => Effect.Effect<
    ConvergentDocument<DocumentType, ParticipantSelectionType>,
    OpenSharedDocumentError
  >;
  getSharedDocumentInfo: (
    args: GetSharedDocumentInfoArgs
  ) => Effect.Effect<SharedDocumentInfo, OpenSharedDocumentError>;
  leaveSharedDocument: (
    args: LeaveSharedDocumentArgs
  ) => Effect.Effect<void, SharedDocumentUnavailableError>;
};
