import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocumentChangeError,
  type ConvergentDocumentUnavailableError,
} from '../errors';
import {
  type ConvergentDocumentVersion,
  type LocalPresence,
  type RemotePresence,
  type RichTextDocument,
} from '../models';

export type ConvergentDocumentState = {
  doc: RichTextDocument;
  version: ConvergentDocumentVersion;
};

// `base` names the version the contributed content was derived from; adapters
// that support concurrent contributions anchor the change there, others
// ignore it.
export type ConvergentDocumentChangeOptions = {
  base?: ConvergentDocumentVersion;
};

// What goes wrong with no call in flight to raise it to: a change that could
// not be applied or published, and the document going away underneath.
export type ConvergentDocumentError =
  ConvergentDocumentChangeError | ConvergentDocumentUnavailableError;

export type Presence = {
  peers: SubscriptionRef.SubscriptionRef<ReadonlyArray<RemotePresence>>;
  publish: (state: LocalPresence) => Effect.Effect<void>;
  close: Effect.Effect<void>;
};

export type ConvergentDocument = {
  content: SubscriptionRef.SubscriptionRef<ConvergentDocumentState>;
  change: (
    content: string,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Who else is at the document right now.
  presence: Omit<Presence, 'close'>;
  errors: Stream.Stream<ConvergentDocumentError>;
  close: Effect.Effect<void>;
};
