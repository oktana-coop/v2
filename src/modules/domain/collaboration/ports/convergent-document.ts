import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocumentChangeError,
  type ConvergentDocumentUnavailableError,
} from '../errors';
import { type ConvergentDocumentVersion } from '../models';
import { type Presence } from './presence';

// `base` names the version the contributed document was derived from; a
// convergent document that supports concurrent contributions anchors the
// change there.
export type ConvergentDocumentChangeOptions = {
  base?: ConvergentDocumentVersion;
};

export type ConvergentDocumentState<DocumentType> = {
  doc: DocumentType;
  version: ConvergentDocumentVersion;
};

// What goes wrong with no call in flight to raise it to: a change that could
// not be applied or published, and the document going away underneath.
export type ConvergentDocumentError =
  ConvergentDocumentChangeError | ConvergentDocumentUnavailableError;

export type ConvergentDocument<DocumentType, ParticipantSelectionType> = {
  content: SubscriptionRef.SubscriptionRef<
    ConvergentDocumentState<DocumentType>
  >;
  change: (
    doc: DocumentType,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Who else is at the document right now.
  presence: Omit<Presence<ParticipantSelectionType>, 'close'>;
  errors: Stream.Stream<ConvergentDocumentError>;
  close: Effect.Effect<void>;
};
