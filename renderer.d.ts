import { FromRendererMessage } from './src/modules/version-control';

export interface AutomergeRepoNetworkAdapter {
  sendRendererMessage: (message: FromRendererMessage) => void;
}

declare global {
  interface Window {
    automergeRepoNetworkAdapter: AutomergeRepoNetworkAdapter;
  }
}
