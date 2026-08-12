import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';

export type CreateAutomergeRepoArgs = {
  syncServiceUrl: string;
};

export const createAutomergeRepo = ({
  syncServiceUrl,
}: CreateAutomergeRepoArgs): Repo =>
  new Repo({ network: [new WebSocketClientAdapter(syncServiceUrl)] });
