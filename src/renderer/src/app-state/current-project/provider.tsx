import { useBranchingOps } from './branching';
import { useCommittingOps } from './committing';
import { ProjectContext } from './context';
import {
  useArtifactMetaDataFromTree,
  useResolveArtifactMetaData,
} from './current-artifact/artifact-metadata';
import { useCurrentArtifactSync } from './current-artifact/sync';
import { useCurrentArtifactId } from './current-artifact/use-current-artifact-id';
import { useDirectoryOps } from './directories';
import { useDocumentOps } from './documents';
import { useExplorerContextMenu } from './explorer-context-menu';
import { useHierarchyOps } from './hierarchy';
import { useHistoryOps } from './history';
import { useMergingOps } from './merging';
import { useProjectOps } from './project';
import { useRemoteOps } from './remotes';
import { useRenamingOps } from './renaming';

export const ProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {
    setCurrentBranch,
    setMergeConflictInfo,
    setRemoteProject,
    setPulledUpstreamChanges,
    ...projectOps
  } = useProjectOps();

  const {
    projectId,
    projectStore,
    directory,
    currentBranch,
    mergeConflictInfo,
    remoteProject,
    pulledUpstreamChanges,
  } = projectOps;

  const historyOps = useHistoryOps({ projectId, projectStore, currentBranch });

  const committingOps = useCommittingOps({ projectId, projectStore });

  const { directoryTree, refreshDirectoryTree } = useHierarchyOps({
    projectId,
    projectStore,
    directory,
    currentBranch,
    pulledUpstreamChanges,
  });

  const currentArtifactId = useCurrentArtifactId();

  const artifactFromTree = useArtifactMetaDataFromTree({
    tree: directoryTree,
    artifactId: currentArtifactId,
  });

  // The store stays the authority for artifacts the tree doesn't have yet,
  // such as a document created since the last refresh. When the tree already
  // had it this resolves redundantly, which is cheap enough to prefer over
  // teaching the hook to skip.
  const { artifact: resolvedArtifact, resolving } = useResolveArtifactMetaData({
    projectId,
    projectStore,
    artifactId: currentArtifactId,
  });

  const currentArtifact = artifactFromTree ?? resolvedArtifact;
  const resolvingCurrentArtifact = !currentArtifact && resolving;
  const currentArtifactPath = currentArtifact?.path ?? null;

  const documentOps = useDocumentOps({
    projectId,
    projectStore,
    directory,
    directoryTree,
    refreshDirectoryTree,
    currentArtifactPath,
  });

  const directoryOps = useDirectoryOps({
    projectId,
    projectStore,
    directoryTree,
    refreshDirectoryTree,
    currentArtifactPath,
  });

  const renamingOps = useRenamingOps({
    projectId,
    projectStore,
    currentBranch,
    refreshDirectoryTree,
    findDocumentInProject: documentOps.findDocumentInProject,
    currentArtifactPath,
  });

  useExplorerContextMenu({
    createNewDocument: documentOps.createNewDocument,
    startCreateDirectory: directoryOps.startCreateDirectory,
    startDeleteDocument: documentOps.startDeleteDocument,
    startDeleteDirectory: directoryOps.startDeleteDirectory,
    startRenameDocument: renamingOps.startRenameDocument,
    startRenameDirectory: renamingOps.startRenameDirectory,
  });

  useCurrentArtifactSync({
    projectId,
    projectStore,
    currentBranch,
    mergeConflictInfo,
    pulledUpstreamChanges,
    findDocumentInProject: documentOps.findDocumentInProject,
    currentArtifactId,
    setPulledUpstreamChanges,
  });

  const branchingOps = useBranchingOps({
    projectId,
    projectStore,
    setCurrentBranch,
    setMergeConflictInfo,
  });

  const mergingOps = useMergingOps({
    projectId,
    projectStore,
    setMergeConflictInfo,
  });

  const remoteOps = useRemoteOps({
    projectId,
    projectStore,
    remoteProject,
    setRemoteProject,
    setPulledUpstreamChanges,
  });

  return (
    <ProjectContext.Provider
      value={{
        ...projectOps,
        currentArtifact,
        resolvingCurrentArtifact,
        directoryTree,
        refreshDirectoryTree,
        ...branchingOps,
        ...mergingOps,
        ...remoteOps,
        ...documentOps,
        ...directoryOps,
        ...renamingOps,
        ...historyOps,
        ...committingOps,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
