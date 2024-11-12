// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import { next as Automerge } from '@automerge/automerge/slim';
import { PeerId, Repo } from '@automerge/automerge-repo/slim';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

import { ElectronIPCRendererProcessAdapter } from '../electron-ipc-network-adapter/renderer';

export const setupForElectron = async (processId: string) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [new ElectronIPCRendererProcessAdapter()],
    storage: new IndexedDBStorageAdapter(),
    peerId: processId as PeerId,
  });
};

export const setupForWeb = async () => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [],
    storage: new IndexedDBStorageAdapter(),
  });
};
