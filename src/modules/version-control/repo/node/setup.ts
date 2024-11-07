// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import { next as Automerge } from '@automerge/automerge/slim';
import { PeerId, Repo } from '@automerge/automerge-repo/slim';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';
import { BrowserWindow } from 'electron';

import { ElectronIPCMainProcessAdapter } from '../electron-ipc-network-adapter/main';

export type SetupProps = {
  processId: string;
  renderers: Map<string, BrowserWindow>;
};

export const setup = async ({ renderers, processId }: SetupProps) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [new ElectronIPCMainProcessAdapter(renderers)],
    storage: new NodeFSStorageAdapter(),
    peerId: processId as PeerId,
  });
};
