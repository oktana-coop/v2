import { useResolveArtifactPath } from '../../hooks/use-artifact-path';
import { useCurrentArtifactId } from '../../hooks/use-current-artifact-id';
import { useBranchingOps } from './branching';
import { useCommittingOps } from './committing';
import { ProjectContext } from './context';
import { useCurrentArtifactSync } from './current-artifact';
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
  const { path: currentArtifactPath } = useResolveArtifactPath({
    projectId,
    projectStore,
    artifactId: currentArtifactId,
  });

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
