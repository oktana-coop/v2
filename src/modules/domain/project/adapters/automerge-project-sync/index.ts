import { isValidAutomergeUrl, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';

import {
  SHARE_FORMAT_VERSION,
  type SharedContent,
} from '../../../rich-text/adapters/automerge-live-document';
import { type ProjectSync } from '../../ports';

export type AutomergeProjectSyncDeps = {
  repo: Repo;
};

export const createAdapter = ({
  repo,
}: AutomergeProjectSyncDeps): ProjectSync => ({
  // Peers converge on a shared document only if they all start from the same
  // bytes, so the first state is minted once here and shipped, never derived
  // again by whoever joins.
  shareDocument: ({ content }) =>
    Effect.sync(() => {
      const genesis: SharedContent = {
        shareFormatVersion: SHARE_FORMAT_VERSION,
        content,
      };

      return repo.create(genesis).url;
    }),

  leaveSharedDocument: ({ shareUrl }) =>
    Effect.sync(() => {
      if (isValidAutomergeUrl(shareUrl)) repo.delete(shareUrl);
    }),
});
