// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import { next as Automerge } from '@automerge/automerge/slim';
import { PeerId, Repo } from '@automerge/automerge-repo/slim';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';
import { type Database } from 'better-sqlite3';
import { BrowserWindow } from 'electron';

import { ElectronIPCMainProcessAdapter } from '../electron-ipc-network-adapter/main';
import { SQLite3StorageAdapter } from '../sqlite3-storage-adapter';

type ElectronSetupProps = {
  processId: string;
  renderers: Map<string, BrowserWindow>;
};

export type FilesystemRepoSetupProps = ElectronSetupProps & {
  directoryPath: string;
};

export const setupFilesystemRepo = async ({
  processId,
  renderers,
  directoryPath,
}: FilesystemRepoSetupProps) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [new ElectronIPCMainProcessAdapter(renderers)],
    storage: new NodeFSStorageAdapter(directoryPath),
    peerId: processId as PeerId,
  });
};

export type SQLiteRepoSetupProps = ElectronSetupProps & {
  db: Database;
};

export const setupSQLiteRepo = async ({
  processId,
  renderers,
  db,
}: SQLiteRepoSetupProps) => {
  await Automerge.initializeWasm(wasmUrl);

  return new Repo({
    network: [new ElectronIPCMainProcessAdapter(renderers)],
    storage: new SQLite3StorageAdapter(db),
    peerId: processId as PeerId,
  });
};
