import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import { next as Automerge } from '@automerge/automerge/slim';
import { Repo } from '@automerge/automerge-repo/slim';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';

await Automerge.initializeWasm(wasmUrl);

type SetupOptions = {
  useFs: boolean;
};

export const setup = ({ useFs = false }: SetupOptions) =>
  new Repo({
    network: [],
    storage: useFs ? new NodeFSStorageAdapter() : new IndexedDBStorageAdapter(),
  });
