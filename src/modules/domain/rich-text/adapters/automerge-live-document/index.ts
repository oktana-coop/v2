import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type AutomergeLiveDocument,
  type AutomergeLiveDocumentDeps,
  createLiveDocument,
} from './live-document';
import {
  type ResolveDocumentError,
  resolvePrivateDocument,
  resolveSyncedDocument,
} from './resolve-document';

export type OpenSharedDocumentError = ResolveDocumentError;

export type AutomergeLiveDocumentAdapterDeps = Omit<
  AutomergeLiveDocumentDeps,
  'handle'
> & {
  // The document's address, for a document that has one. Without it the
  // adapter starts a document of its own, holding what the store read.
  address?: string;
};

// Only opening at an address can fail; starting a document of its own
// cannot, so callers without one can rule the error out.
export const createAdapter = (
  deps: AutomergeLiveDocumentAdapterDeps
): Effect.Effect<AutomergeLiveDocument, OpenSharedDocumentError> =>
  pipe(
    deps.address === undefined
      ? resolvePrivateDocument({
          repo: deps.privateRepo,
          content: deps.initialText,
        })
      : resolveSyncedDocument({
          repo: deps.syncedRepo,
          address: deps.address,
        }),
    Effect.flatMap((handle) => createLiveDocument({ ...deps, handle }))
  );

export { type ResolveDocumentError } from './resolve-document';
export { type Unsubscribe } from './live-document';
export {
  genesisFor,
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';
