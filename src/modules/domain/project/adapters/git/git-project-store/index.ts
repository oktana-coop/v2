import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import { type DocumentAnalyzer } from '../../../../../../modules/domain/rich-text';
import { type Filesystem } from '../../../../../../modules/infrastructure/filesystem';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../constants';
import { ProjectStore } from '../../../ports';
import { getArtifactPathById, lookupArtifactByPath } from './artifacts';
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

export const createAdapter = ({
  isoGitFs,
  filesystem,
  isoGitHttp,
  documentAnalyzer,
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
    documentAnalyzer,
  });

  const directoryOps = createDirectoryOps({ filesystem, documentOps });

  const hierarchyOps = createHierarchyOps({ isoGitFs, filesystem });

  const branchingOps = createBranchingOps({ isoGitFs });

  const remoteOps = createRemoteOps({ isoGitFs, isoGitHttp });

  const mergingOps = createMergingOps({ isoGitFs });

  const renamingOps = createRenamingOps({ isoGitFs, filesystem });

  const committingOps = createCommittingOps({
    isoGitFs,
    filesystem,
    documentAnalyzer,
  });

  const historyOps = createHistoryOps({ isoGitFs });

  const authOps = createAuthOps({ isoGitFs });

  return {
    supportsBranching: true,
    assetsDirName,
    getArtifactPathById,
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
  };
};
