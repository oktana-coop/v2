import { type VersionControlSystem } from '../infrastructure/version-control';

export type BuildConfig = {
  useHistoryWorker: boolean;
  singleDocumentProjectVersionControlSystem: VersionControlSystem;
  multiDocumentProjectVersionControlSystem: VersionControlSystem;
};
