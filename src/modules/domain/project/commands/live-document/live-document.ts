import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
  type RichTextDocument,
} from '../../../../../modules/domain/rich-text';
import { type OpenSharedDocumentError, type ShareUrl } from '../../ports';
import { type PersistDocumentError } from '../persist-document';

export type LiveDocument = {
  content: SubscriptionRef.SubscriptionRef<ConvergentDocumentState>;
  change: (
    doc: RichTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // Continues on the shared document behind this link, keeping everything
  // that follows `content` bound to it.
  attachTo: (
    shareUrl: ShareUrl
  ) => Effect.Effect<void, OpenSharedDocumentError>;
  // Continues on a private document, holding what it holds now.
  detach: Effect.Effect<void>;
  flush: Effect.Effect<void, PersistDocumentError>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
  close: Effect.Effect<void>;
};
