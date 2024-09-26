import type { Repo } from './src/modules/version-control';

export interface ElectronAPI {
  setupVersionControlRepo: () => Promise<Repo>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
