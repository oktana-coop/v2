import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import { type DocumentAnalyzer } from '../../../../../../modules/domain/rich-text';
import { type Filesystem } from '../../../../../../modules/infrastructure/filesystem';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../constants';
import { ProjectStore } from '../../../ports';
import { createAssetOps } from './assets';
import { createAuthOps } from './auth';
import { createBranchingOps } from './branching';
import { createCommittingOps } from './committing';
import { createDocumentOps } from './documents';
import { createHistoryOps } from './history';
import { createMergingOps } from './merging';
import { createProjectOps } from './project';
import { createRemoteOps } from './remotes';
import { createRenamingOps } from './renaming';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  isoGitHttp,
  documentAnalyzer,
  managesFilesystemWorkdir,
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
  managesFilesystemWorkdir: boolean;
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

  const documentOps = createDocumentOps({
    isoGitFs,
    filesystem,
    managesFilesystemWorkdir,
    documentAnalyzer,
  });

  const branchingOps = createBranchingOps({ isoGitFs });

  const remoteOps = createRemoteOps({ isoGitFs, isoGitHttp });

  const mergingOps = createMergingOps({ isoGitFs });

  const renamingOps = createRenamingOps({ isoGitFs });

  const committingOps = createCommittingOps({
    isoGitFs,
    filesystem,
    documentAnalyzer,
  });

  const historyOps = createHistoryOps({ isoGitFs });

  const authOps = createAuthOps({ isoGitFs });

  return {
    supportsBranching: true,
    managesFilesystemWorkdir,
    assetsDirName,
    ...projectOps,
    ...documentOps,
    ...branchingOps,
    ...assetOps,
    ...remoteOps,
    ...mergingOps,
    ...renamingOps,
    ...committingOps,
    ...historyOps,
    ...authOps,
  };
};
