import * as Effect from 'effect/Effect';

import type {
  ResolvedDocument,
  RichTextRepresentation,
  VersionedDocument,
} from '../../../../modules/domain/rich-text';
import { type AlreadyExistsError } from '../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  type Branch,
  type Change,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  MergeConflictError,
  type MergeConflictInfo,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { type Email, type Username } from '../../../auth';
import {
  DeletedDocumentError,
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../errors';
import {
  type ArtifactMetaData,
  type AssetMetaData,
  type DocumentMetaData,
  type Project,
  type ProjectId,
  type ProjectRelPath,
  type ProjectTreeNode,
  type ReferencedAsset,
  type RemoteProjectInfo,
  type VersionedProject,
} from '../models';

type UserInfo = {
  username: Username | null;
  email: Email | null;
};

export type CreateProjectArgs = {
  path: string;
  documents?: Project['documents'];
  cloneUrl?: string;
  authToken?: string;
} & UserInfo;

export type AddAssetToProjectArgs = {
  projectId: ProjectId;
  name: string;
  content: Uint8Array;
};

export type DeleteAssetFromProjectArgs = {
  projectId: ProjectId;
  assetId: ArtifactId;
};

export type LookupAssetByNameInProjectArgs = {
  projectId: ProjectId;
  name: string;
};

export type ReadAssetBytesFromProjectArgs = {
  projectId: ProjectId;
  relPath: ProjectRelPath;
};

export type ReadDocumentReferencedAssetsFromProjectArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type GetProjectRelativePathArgs = {
  projectId: ProjectId;
  absolutePath: string;
};

export type DeleteDocumentsArgs = {
  projectId: ProjectId;
  documentIds: ArtifactId[];
  deleteFromFilesystem?: boolean;
  directoryPath?: string;
};

export type RenameDocumentInProjectArgs = {
  projectId: ProjectId;
  oldDocumentPath: string;
  newDocumentPath: string;
};

export type RenameDirectoryArgs = {
  projectId: ProjectId;
  oldDirectoryPath: string;
  newDirectoryName: string;
};

export type RenameDirectoryResult = {
  newDirectoryPath: ProjectRelPath;
};

export type LookupDocumentInProjectArgs = {
  projectId: ProjectId;
  documentPath: string;
  changeId?: ChangeId;
};

export type ProjectCommitChangesArgs = {
  projectId: ProjectId;
  message: string;
};

export type ProjectCommitDocumentChangesArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  message: string;
};

export type CommitDocumentChangesResult = {
  commitId: Commit['id'];
  // Referenced assets that were not on disk and so were left out of the commit.
  skippedAssetPaths: ProjectRelPath[];
};

export type ProjectRestoreDocumentChangesArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  commit: Commit;
  message?: string;
};

export type RestoreDocumentChangesResult = {
  commitId: Commit['id'];
  // Referenced assets that could not be read from the restored commit and so
  // were left out (the restored document keeps a dangling reference to them).
  skippedAssetPaths: ProjectRelPath[];
};

export type ProjectCreateAndSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectSwitchToBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectGetCurrentBranchArgs = {
  projectId: ProjectId;
};

export type ProjectListBranchesArgs = {
  projectId: ProjectId;
};

export type ProjectDeleteBranchArgs = {
  projectId: ProjectId;
  branch: Branch;
};

export type ProjectDeleteBranchResult = {
  currentBranch: Branch;
};

export type ProjectMergeAndDeleteBranchArgs = {
  projectId: ProjectId;
  from: Branch;
  into: Branch;
};

export type ProjectIsInMergeConflictStateArgs = {
  projectId: ProjectId;
};

export type ProjectGetMergeConflictInfoArgs = {
  projectId: ProjectId;
};

export type ProjectAbortMergeArgs = {
  projectId: ProjectId;
};

export type ProjectResolveConflictByKeepingDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type ProjectResolveConflictByDeletingDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type ProjectCommitMergeConflictsResolutionArgs = {
  projectId: ProjectId;
  message?: string;
};

export type ProjectSetAuthorInfoArgs = {
  projectId: ProjectId;
  username: Username | null;
  email: Email | null;
};

export type ProjectAddRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  remoteUrl: string;
  authToken?: string;
};

export type ProjectListRemoteProjectsArgs = {
  projectId: ProjectId;
};

export type ProjectFindRemoteProjectByNameArgs = {
  projectId: ProjectId;
  remoteName: string;
};

export type ProjectPushToRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectPullFromRemoteProjectArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectGetProjectCommitHistoryArgs = {
  projectId: ProjectId;
  branch: Branch;
  limit?: number;
};

export type ProjectGetChangedDocumentsAtChangeArgs = {
  projectId: ProjectId;
  changeId: ChangeId;
};

export type ProjectGetRemoteBranchInfoArgs = {
  projectId: ProjectId;
  remoteName?: string;
  authToken?: string;
};

export type ProjectGetRemoteBranchInfoResult = Record<Branch, Commit['id']>;

export type CreateDocumentArgs = {
  projectId: ProjectId;
  content: string | null;
  filePath?: string;
  writeToFile?: boolean;
  branch?: Branch;
};

export type CreateDirectoryArgs = {
  projectId: ProjectId;
  parentDirectoryPath?: ProjectRelPath;
  name: string;
};

export type DeleteDirectoryArgs = {
  projectId: ProjectId;
  directoryPath: ProjectRelPath;
};

export type GetArtifactMetaDataByIdArgs = {
  projectId: ProjectId;
  artifactId: ArtifactId;
};

export type LookupArtifactByPathArgs = {
  projectId: ProjectId;
  path: string;
  // Store-specific version hint (branch or commit for git).
  ref: string;
};

export type FindDocumentByIdArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type GetDocumentLastChangeIdArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type UpdateRichTextDocumentContentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  representation: RichTextRepresentation;
  content: string;
};

export type DeleteDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  deleteFromFilesystem?: boolean;
};

export type GetDocumentHistoryArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type GetDocumentHistoryResponse = {
  history: Change[];
  current: VersionedDocument;
  latestChange: Change;
  lastCommit: Commit | null;
  hasUncommittedChanges: boolean;
};

export type GetDocumentAtChangeArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  changeId: Change['id'];
};

export type IsContentSameAtChangesArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  change1: Change['id'];
  change2: Change['id'];
};

export type DiscardUncommittedChangesArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type ResolveContentConflictArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export type ProjectStore = {
  supportsBranching: boolean;
  assetsDirName: string;
  // Resolves an artifact id to everything needed to render it. Only the store
  // can do this: a git id embeds its path, but that is an implementation
  // detail other backends don't share.
  getArtifactMetaDataById: (
    args: GetArtifactMetaDataByIdArgs
  ) => Effect.Effect<
    ArtifactMetaData,
    ValidationError | RepositoryError,
    never
  >;
  lookupArtifactByPath: (
    args: LookupArtifactByPathArgs
  ) => Effect.Effect<ArtifactId, ValidationError | RepositoryError, never>;
  createProject: (
    args: CreateProjectArgs
  ) => Effect.Effect<ProjectId, ValidationError | RepositoryError, never>;
  findProjectById: (
    id: ProjectId
  ) => Effect.Effect<
    VersionedProject,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectDocuments: (
    id: ProjectId
  ) => Effect.Effect<
    DocumentMetaData[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getProjectTree: (
    id: ProjectId
  ) => Effect.Effect<
    ProjectTreeNode[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  deleteDocuments: (
    args: DeleteDocumentsArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  renameDocumentInProject: (
    args: RenameDocumentInProjectArgs
  ) => Effect.Effect<
    void,
    | AlreadyExistsError
    | ValidationError
    | MigrationError
    | RepositoryError
    | NotFoundError,
    never
  >;
  renameDirectory: (
    args: RenameDirectoryArgs
  ) => Effect.Effect<
    RenameDirectoryResult,
    | AlreadyExistsError
    | ValidationError
    | MigrationError
    | RepositoryError
    | NotFoundError,
    never
  >;
  lookupDocumentInProject: (
    args: LookupDocumentInProjectArgs
  ) => Effect.Effect<
    ArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findDocumentByPath: (
    args: LookupDocumentInProjectArgs
  ) => Effect.Effect<
    ResolvedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  addAssetToProject: (
    args: AddAssetToProjectArgs
  ) => Effect.Effect<
    ArtifactId,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  deleteAssetFromProject: (
    args: DeleteAssetFromProjectArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  lookupAssetByName: (
    args: LookupAssetByNameInProjectArgs
  ) => Effect.Effect<
    ArtifactId,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  listProjectAssets: (
    id: ProjectId
  ) => Effect.Effect<
    AssetMetaData[],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  readAssetBytes: (
    args: ReadAssetBytesFromProjectArgs
  ) => Effect.Effect<
    Uint8Array,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  readDocumentReferencedAssets: (
    args: ReadDocumentReferencedAssetsFromProjectArgs
  ) => Effect.Effect<
    ReferencedAsset[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getProjectRelativePath: (
    args: GetProjectRelativePathArgs
  ) => Effect.Effect<string | null, RepositoryError, never>;
  commitChanges: (
    args: ProjectCommitChangesArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  commitDocumentChanges: (
    args: ProjectCommitDocumentChangesArgs
  ) => Effect.Effect<
    CommitDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  restoreDocumentChanges: (
    args: ProjectRestoreDocumentChangesArgs
  ) => Effect.Effect<
    RestoreDocumentChangesResult,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  createAndSwitchToBranch: (
    args: ProjectCreateAndSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  switchToBranch: (
    args: ProjectSwitchToBranchArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getCurrentBranch: (
    args: ProjectGetCurrentBranchArgs
  ) => Effect.Effect<
    Branch,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  listBranches: (
    args: ProjectListBranchesArgs
  ) => Effect.Effect<
    Branch[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  deleteBranch: (
    args: ProjectDeleteBranchArgs
  ) => Effect.Effect<
    ProjectDeleteBranchResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  mergeAndDeleteBranch: (
    args: ProjectMergeAndDeleteBranchArgs
  ) => Effect.Effect<
    Commit['id'],
    ValidationError | RepositoryError | NotFoundError | MergeConflictError,
    never
  >;
  getMergeConflictInfo: (
    args: ProjectGetMergeConflictInfoArgs
  ) => Effect.Effect<
    MergeConflictInfo | null,
    ValidationError | RepositoryError,
    never
  >;
  abortMerge: (
    args: ProjectAbortMergeArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByKeepingDocument: (
    args: ProjectResolveConflictByKeepingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  resolveConflictByDeletingDocument: (
    args: ProjectResolveConflictByDeletingDocumentArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  commitMergeConflictsResolution: (
    args: ProjectCommitMergeConflictsResolutionArgs
  ) => Effect.Effect<Commit['id'], ValidationError | RepositoryError, never>;
  setAuthorInfo: (
    args: ProjectSetAuthorInfoArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  // TODO: Consider moving to a separate, composable type like ExplicitSyncProjectStore
  addRemoteProject: (
    args: ProjectAddRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  listRemoteProjects: (
    args: ProjectListRemoteProjectsArgs
  ) => Effect.Effect<
    RemoteProjectInfo[],
    ValidationError | RepositoryError,
    never
  >;
  findRemoteProjectByName: (
    args: ProjectFindRemoteProjectByNameArgs
  ) => Effect.Effect<
    RemoteProjectInfo,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  pushToRemoteProject: (
    args: ProjectPushToRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  pullFromRemoteProject: (
    args: ProjectPullFromRemoteProjectArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
  getProjectCommitHistory: (
    args: ProjectGetProjectCommitHistoryArgs
  ) => Effect.Effect<
    Commit[],
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  getChangedDocumentsAtChange: (
    args: ProjectGetChangedDocumentsAtChangeArgs
  ) => Effect.Effect<
    ChangedDocument[],
    ValidationError | RepositoryError,
    never
  >;
  getRemoteBranchInfo: (
    args: ProjectGetRemoteBranchInfoArgs
  ) => Effect.Effect<
    ProjectGetRemoteBranchInfoResult,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  createDocument: (
    args: CreateDocumentArgs
  ) => Effect.Effect<ArtifactId, ValidationError | RepositoryError, never>;
  createDirectory: (
    args: CreateDirectoryArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError,
    never
  >;
  deleteDirectory: (
    args: DeleteDirectoryArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  findDocumentById: (
    args: FindDocumentByIdArgs
  ) => Effect.Effect<
    ResolvedDocument,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentLastChangeId: (
    args: GetDocumentLastChangeIdArgs
  ) => Effect.Effect<
    Change['id'],
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  updateRichTextDocumentContent: (
    args: UpdateRichTextDocumentContentArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  deleteDocument: (
    args: DeleteDocumentArgs
  ) => Effect.Effect<
    void,
    ValidationError | MigrationError | RepositoryError | NotFoundError,
    never
  >;
  getDocumentHistory: (
    args: GetDocumentHistoryArgs
  ) => Effect.Effect<
    GetDocumentHistoryResponse,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  getDocumentAtChange: (
    args: GetDocumentAtChangeArgs
  ) => Effect.Effect<
    VersionedDocument,
    | ValidationError
    | RepositoryError
    | NotFoundError
    | MigrationError
    | DeletedDocumentError,
    never
  >;
  isContentSameAtChanges: (
    args: IsContentSameAtChangesArgs
  ) => Effect.Effect<
    boolean,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  discardUncommittedChanges: (
    args: DiscardUncommittedChangesArgs
  ) => Effect.Effect<
    void,
    ValidationError | RepositoryError | NotFoundError | MigrationError,
    never
  >;
  resolveContentConflict: (
    args: ResolveContentConflictArgs
  ) => Effect.Effect<void, ValidationError | RepositoryError, never>;
};
