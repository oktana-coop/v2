import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type RichTextDocument } from '../models';

export type ConvergentDocumentVersion = string;

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

export type ConvergentDocument = {
  content: SubscriptionRef.SubscriptionRef<ConvergentDocumentState>;
  change: (
    content: string,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  close: Effect.Effect<void>;
};
