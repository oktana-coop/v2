// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import * as Automerge from '@automerge/automerge/slim';
import { Repo } from '@automerge/automerge-repo/slim';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

import { ElectronIPCRendererProcessAdapter } from '../electron-ipc-network-adapter/renderer';

export type IndexedDBArgs = {
  dbName: string;
  store: string;
};

export type SetupForElectronArgs = IndexedDBArgs & {
  processId: string;
  initiateSync?: boolean;
};

export const setupForElectron = async ({
  processId,
  dbName,
  store,
  initiateSync = false,
}: SetupForElectronArgs) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [new ElectronIPCRendererProcessAdapter(processId, initiateSync)],
    storage: new IndexedDBStorageAdapter(dbName, store),
  });
};

export const setupForWeb = async ({ dbName, store }: IndexedDBArgs) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [],
    storage: new IndexedDBStorageAdapter(dbName, store),
  });
};
