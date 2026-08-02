import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type RichTextDocument } from '../models';

export type LiveDocumentVersion = string;

export type LiveDocumentChange = {
  doc: RichTextDocument;
  version: LiveDocumentVersion;
};

export type LiveDocument = {
  content: SubscriptionRef.SubscriptionRef<LiveDocumentChange>;
  change: (doc: RichTextDocument) => Effect.Effect<LiveDocumentVersion>;
};
