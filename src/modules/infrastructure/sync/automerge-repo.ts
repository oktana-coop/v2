// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import * as Automerge from '@automerge/automerge/slim';
import { Repo } from '@automerge/automerge-repo/slim';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../utils/errors';
import { SyncServiceError } from './errors';

export type CreateAutomergeRepoArgs = {
  syncServiceUrl: string;
};

export const createAutomergeRepo = ({
  syncServiceUrl,
}: CreateAutomergeRepoArgs): Effect.Effect<Repo, SyncServiceError> =>
  pipe(
    Effect.tryPromise({
      try: () => Automerge.initializeWasm(wasmUrl),
      catch: mapErrorTo(SyncServiceError, 'Error in initializing Automerge.'),
    }),
    Effect.map(
      () => new Repo({ network: [new WebSocketClientAdapter(syncServiceUrl)] })
    )
  );
