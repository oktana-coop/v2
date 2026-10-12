import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { type LocalEditsContributionError } from '../../errors';
import { type ConvergentDocumentVersion, type ShareId } from '../../models';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentError,
  type ConvergentDocumentState,
  type OpenSharedDocumentError,
  type Presence,
} from '../../ports';

// Failures with nobody waiting on them: the document's own, and the editor's
// edits failing to reach it.
export type EditableLiveDocumentError =
  ConvergentDocumentError | LocalEditsContributionError;

export type LiveDocument<
  DocumentType = unknown,
  ParticipantSelectionType = unknown,
> = {
  documentId: ArtifactId;
  content: SubscriptionRef.SubscriptionRef<
    ConvergentDocumentState<DocumentType>
  >;
  // What the document holds now.
  currentDocument: Effect.Effect<DocumentType>;
  change: (
    doc: DocumentType,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Who else is at the document, following it through shares and leaves.
  presence: Omit<Presence<ParticipantSelectionType>, 'close'>;
  // Continues on the shared document behind this link, keeping everything
  // that follows `content` bound to it.
  attachTo: (shareId: ShareId) => Effect.Effect<void, OpenSharedDocumentError>;
  // Continues on a private document, holding what it holds now.
  detach: Effect.Effect<void>;
  errors: Stream.Stream<ConvergentDocumentError>;
  close: Effect.Effect<void>;
};

// The editor's edits, and those still on their way to the document.
export type LocalEditing<EditorDocumentType> = {
  edit: (
    doc: EditorDocumentType,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Contributes the editor's edits still on their way to the document now,
  // without waiting for the pause that normally contributes them.
  applyPendingLocalEdits: Effect.Effect<void, LocalEditsContributionError>;
  // Drops the editor's edits still on their way to the document; whoever
  // waits for them gets the version the document holds.
  dropPendingLocalEdits: Effect.Effect<void>;
};

// Switching first contributes the editor's edits still on their way, which
// can fail.
export type EditableLiveDocument<
  DocumentType = unknown,
  ParticipantSelectionType = unknown,
  EditorDocumentType = DocumentType,
> = Omit<
  LiveDocument<DocumentType, ParticipantSelectionType>,
  'attachTo' | 'detach' | 'errors'
> &
  LocalEditing<EditorDocumentType> & {
    attachTo: (
      shareId: ShareId
    ) => Effect.Effect<
      void,
      OpenSharedDocumentError | LocalEditsContributionError
    >;
    detach: Effect.Effect<void, LocalEditsContributionError>;
    errors: Stream.Stream<EditableLiveDocumentError>;
  };

export type NamedLiveDocument<
  DocumentType = unknown,
  ParticipantSelectionType = unknown,
  EditorDocumentType = DocumentType,
> = EditableLiveDocument<
  DocumentType,
  ParticipantSelectionType,
  EditorDocumentType
> & {
  name: string;
};
