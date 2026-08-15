import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type SharedDocumentUnavailableError,
  type UnsupportedShareFormatError,
  type ValidationError,
} from '../errors';
import { type RichTextDocument } from '../models';

export type LiveDocumentVersion = string;

// Where a live document's backing document can be reached. Opaque capability:
// whoever holds it can attach to that document.
export type LiveDocumentAddress = string;

export type AttachLiveDocumentError =
  | ValidationError
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError;

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
  // Resolves with the version whose content is exactly the contributed doc,
  // and only after the resulting state has been published to `content` — so
  // a contributor can recognize its own echo by version.
  change: (
    doc: RichTextDocument,
    options?: LiveDocumentChangeOptions
  ) => Effect.Effect<LiveDocumentVersion>;
  // Continues on the document reachable at this address, keeping the editor
  // bound to it: what sharing and joining do to an open document.
  attachTo: (
    address: LiveDocumentAddress
  ) => Effect.Effect<void, AttachLiveDocumentError>;
  // Continues on a document of its own, seeded with the current content:
  // what leaving a share does.
  detach: Effect.Effect<void>;
  close: Effect.Effect<void>;
};
