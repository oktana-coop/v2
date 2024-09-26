import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';

type SetupOptions = {
  useFs: boolean;
};

export const setup = ({ useFs = false }: SetupOptions) =>
  new Repo({
    network: [new BrowserWebSocketClientAdapter('wss://sync.automerge.org')],
    storage: useFs ? new NodeFSStorageAdapter() : new IndexedDBStorageAdapter(),
  });
