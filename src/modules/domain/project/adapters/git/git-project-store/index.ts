import * as Effect from 'effect/Effect';
import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import { type DocumentAnalyzer } from '../../../../../../modules/domain/rich-text';
import {
  type DirectoryWatcher,
  type Filesystem,
} from '../../../../../../modules/infrastructure/filesystem';
import { type Mutex } from '../../../../../../utils/effect';
import { DEFAULT_ASSETS_DIR_NAME, GIT_DIR_NAME } from '../../../constants';
import { ProjectStore } from '../../../ports';
import { getArtifactMetaDataById, lookupArtifactByPath } from './artifacts';
import { createAssetOps } from './assets';
import { createAuthOps } from './auth';
import { createBranchingOps } from './branching';
import { createCommittingOps } from './committing';
import { createDirectoryOps } from './directories';
import { createDocumentOps } from './documents';
import { createHierarchyOps } from './hierarchy';
import { createHistoryOps } from './history';
import { createMergingOps } from './merging';
import { createProjectOps } from './project';
import { createRemoteOps } from './remotes';
import { createRenamingOps } from './renaming';
import { createWatchingOps } from './watching';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  isoGitHttp,
  documentAnalyzer,
  directoryWatcher,
  assetsDirName = DEFAULT_ASSETS_DIR_NAME,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  isoGitHttp: IsoGitHttpApi;
  documentAnalyzer: DocumentAnalyzer;
  directoryWatcher: DirectoryWatcher;
  // Folder for new asset insertions, relative to the project root. Defaults
  // to DEFAULT_ASSETS_DIR_NAME; will eventually be sourced from a user
  // setting.
  assetsDirName?: string;
}): ProjectStore => {
  const projectOps = createProjectOps({ isoGitFs, isoGitHttp, filesystem });

  const assetOps = createAssetOps({
    isoGitFs,
    filesystem,
    assetsDirName,
  });

  // Not reentrant: an operation holding it must never call another that does.
  const currentBranchMutex: Mutex =
    Effect.unsafeMakeSemaphore(1).withPermits(1);

  const documentOps = createDocumentOps({
    isoGitFs,
    filesystem,
    documentAnalyzer,
    currentBranchMutex,
  });

  const directoryOps = createDirectoryOps({ filesystem, documentOps });

  const hierarchyOps = createHierarchyOps({ isoGitFs, filesystem });

  const branchingOps = createBranchingOps({ isoGitFs, currentBranchMutex });

  const remoteOps = createRemoteOps({ isoGitFs, isoGitHttp });

  const mergingOps = createMergingOps({ isoGitFs });

  const renamingOps = createRenamingOps({ isoGitFs, filesystem });

  const committingOps = createCommittingOps({
    isoGitFs,
    filesystem,
    documentAnalyzer,
    currentBranchMutex,
  });

  const historyOps = createHistoryOps({ isoGitFs });

  const authOps = createAuthOps({ isoGitFs });

  const watchingOps = createWatchingOps({ directoryWatcher });

  return {
    supportsBranching: true,
    assetsDirName,
    versionControlDirName: GIT_DIR_NAME,
    getArtifactMetaDataById,
    lookupArtifactByPath,
    ...projectOps,
    ...documentOps,
    ...directoryOps,
    ...hierarchyOps,
    ...branchingOps,
    ...assetOps,
    ...remoteOps,
    ...mergingOps,
    ...renamingOps,
    ...committingOps,
    ...historyOps,
    ...authOps,
    ...watchingOps,
  };
};
