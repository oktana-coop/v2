import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type SharedDocumentUnavailableError,
  type UnsupportedShareFormatError,
  type ValidationError,
} from '../errors';
import { type RichTextDocument } from '../models';

export type ConvergentDocumentVersion = string;

// Where a convergent document can be reached. Opaque capability: whoever
// holds it can attach to that document.
export type ConvergentDocumentAddress = string;

export type AttachConvergentDocumentError =
  | ValidationError
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError;

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
  // Takes the document's content in the primary text representation, which
  // is what a convergent document holds. Resolves with the version whose content
  // is exactly that, and only after it has been published to `content` — so
  // a contributor can recognize its own echo by version.
  change: (
    content: string,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Continues on the document reachable at this address, keeping everything
  // that follows `content` bound to it: what sharing and joining come down to.
  attachTo: (
    address: ConvergentDocumentAddress
  ) => Effect.Effect<void, AttachConvergentDocumentError>;
  // Continues on a document of its own, seeded with the current content:
  // what leaving a share does.
  detach: Effect.Effect<void>;
  close: Effect.Effect<void>;
};
