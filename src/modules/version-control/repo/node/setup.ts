// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import { next as Automerge } from '@automerge/automerge/slim';
import { Repo } from '@automerge/automerge-repo/slim';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';

export const setup = async () => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [],
    storage: new NodeFSStorageAdapter(),
  });
};
