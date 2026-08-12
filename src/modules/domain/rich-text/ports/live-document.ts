import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type RichTextDocument } from '../models';

export type LiveDocumentVersion = string;

export type LiveDocumentChange = {
  doc: RichTextDocument;
  version: LiveDocumentVersion;
};

// `base` names the version the contributed doc was derived from; adapters
// that support concurrent contributions anchor the change there, others
// ignore it.
export type LiveDocumentChangeOptions = {
  base?: LiveDocumentVersion;
};

export type LiveDocument = {
  content: SubscriptionRef.SubscriptionRef<LiveDocumentChange>;
  change: (
    doc: RichTextDocument,
    options?: LiveDocumentChangeOptions
  ) => Effect.Effect<LiveDocumentVersion>;
  close: Effect.Effect<void>;
};
