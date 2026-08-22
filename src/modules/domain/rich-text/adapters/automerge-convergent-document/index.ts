import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ConvergentDocument } from '../../ports/convergent-document';
import {
  type AutomergeConvergentDocumentDeps,
  createConvergentDocument,
} from './convergent-document';
import {
  type ResolveDocumentError,
  resolvePrivateDocument,
  resolveSyncedDocument,
} from './resolve-document';

export type OpenSharedDocumentError = ResolveDocumentError;

export type AutomergeConvergentDocumentAdapterDeps = Omit<
  AutomergeConvergentDocumentDeps,
  'handle'
> & {
  // What the store holds, for a document that has to be started from it.
  initialText: string;
  // The document's address, for a document that has one. Without it the
  // adapter starts a document of its own.
  address?: string;
};

// Only opening at an address can fail; starting a document of its own
// cannot, so callers without one can rule the error out.
export const createAdapter = (
  deps: AutomergeConvergentDocumentAdapterDeps
): Effect.Effect<ConvergentDocument, OpenSharedDocumentError> =>
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
    Effect.flatMap((handle) => createConvergentDocument({ ...deps, handle }))
  );

export { type ResolveDocumentError } from './resolve-document';
export { type Unsubscribe } from './convergent-document';
export {
  genesisFor,
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';
