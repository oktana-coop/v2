import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useMatch } from 'react-router';

import {
  type ChangedDocument,
  type Commit,
  decodeUrlEncodedArtifactId,
  decodeUrlEncodedChangeId,
  decomposeGitBlobRef,
  isGitBlobRef,
  isUncommittedChangeId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { MultiDocumentProjectContext } from '../../../../app-state';
import { PersonalFile } from '../../../../components/illustrations/PersonalFile';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useProjectHistoryDocumentSelection } from '../../../../hooks/multi-document-project';
import { CommitDialog } from '../change-dialogs';
import { type ProjectHistoryOutletContext } from './main/ProjectHistoryDocumentView';
import { CommitHistoryPanel } from './sidebar/CommitHistoryPanel';
import { UncommittedChangesPanel } from './sidebar/UncommittedChangesPanel';

const HIDDEN_FILES = new Set(['.gitignore']);

const EmptyDetailView = () => (
  <div className="flex h-full w-full flex-col items-center justify-center">
    <PersonalFile />
    <p>No document selected</p>
  </div>
);

export const ProjectHistoryPage = () => {
  const {
    getProjectHistory,
    getProjectChangedDocuments,
    getProjectUncommittedChanges,
    commitChanges,
  } = useContext(MultiDocumentProjectContext);

  const selectDocument = useProjectHistoryDocumentSelection();

  const [commits, setCommits] = useState<Commit[]>([]);
  const [uncommittedChanges, setUncommittedChanges] = useState<
    ChangedDocument[]
  >([]);
  const [expandedCommitDocuments, setExpandedCommitDocuments] = useState<
    Record<string, ChangedDocument[]>
  >({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingCommitDocuments, setLoadingCommitDocuments] = useState<
    Set<string>
  >(new Set());
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [loadingUncommitted, setLoadingUncommitted] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);

  const loadCommits = useCallback(async () => {
    setLoadingCommits(true);
    try {
      const result = await getProjectHistory();
      setCommits(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCommits(false);
    }
  }, [getProjectHistory]);

  const loadUncommittedChanges = useCallback(async () => {
    setLoadingUncommitted(true);
    try {
      const result = await getProjectUncommittedChanges();
      setUncommittedChanges(
        result.filter((change) => !HIDDEN_FILES.has(change.path))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingUncommitted(false);
    }
  }, [getProjectUncommittedChanges]);

  useEffect(() => {
    loadCommits();
  }, [loadCommits]);

  useEffect(() => {
    loadUncommittedChanges();
  }, [loadUncommittedChanges]);

  const toggleCommitExpansion = useCallback(
    async (commitId: Commit['id']) => {
      const key = urlEncodeChangeId(commitId);

      // Toggle the commit row open/closed in the sidebar.
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });

      // Skip fetching if we already have the documents for this commit.
      if (expandedCommitDocuments[key]) return;

      // Mark this commit as loading while we fetch its changed documents.
      setLoadingCommitDocuments((prev) => new Set(prev).add(key));
      try {
        const documents = await getProjectChangedDocuments(commitId);
        setExpandedCommitDocuments((prev) => ({
          ...prev,
          [key]: documents,
        }));
      } catch (error) {
        console.error(error);
      } finally {
        // Done loading, whether it succeeded or failed.
        // Mark this commit as finished (not) loading.
        setLoadingCommitDocuments((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [getProjectChangedDocuments, expandedCommitDocuments]
  );

  const handleCommit = useCallback(
    async (message: string) => {
      await commitChanges(message);
      await loadCommits();
      await loadUncommittedChanges();
      setIsCommitDialogOpen(false);
    },
    [commitChanges, loadCommits, loadUncommittedChanges]
  );

  const documentChangeMatch = useMatch(
    '/projects/:projectId/history/:documentId/changes/:changeId'
  );

  const selectedDocumentPath = useMemo(() => {
    const encodedDocumentId = documentChangeMatch?.params.documentId;
    if (!encodedDocumentId) return null;
    const documentId = decodeUrlEncodedArtifactId(encodedDocumentId);
    if (!documentId || !isGitBlobRef(documentId)) return null;
    return decomposeGitBlobRef(documentId).path;
  }, [documentChangeMatch]);

  const selectedCommitId = useMemo((): Commit['id'] | null => {
    const encodedChangeId = documentChangeMatch?.params.changeId;
    if (!encodedChangeId) return null;
    const changeId = decodeUrlEncodedChangeId(encodedChangeId);
    return isUncommittedChangeId(changeId) ? null : changeId;
  }, [documentChangeMatch]);

  const handleOpenCommitDialog = () => setIsCommitDialogOpen(true);
  const handleCancelCommitDialog = () => setIsCommitDialogOpen(false);

  const handleSelectUncommittedDocument = (path: string) => {
    selectDocument(path);
  };

  const handleSelectCommitDocument = ({
    document,
    commitId,
  }: {
    document: ChangedDocument;
    commitId: Commit['id'];
  }) => {
    selectDocument(document.path, commitId);
  };

  if (loadingCommits && loadingUncommitted) {
    return (
      <SidebarLayout
        sidebar={<div className="p-4 text-sm text-zinc-400">Loading...</div>}
      >
        <div />
      </SidebarLayout>
    );
  }

  return (
    <>
      <SidebarLayout
        sidebar={
          <StackedResizablePanelsLayout autoSaveId="project-history-sidebar">
            <UncommittedChangesPanel
              changes={uncommittedChanges}
              selectedDocumentPath={selectedDocumentPath}
              onSelectDocument={handleSelectUncommittedDocument}
              onOpenCommitDialog={handleOpenCommitDialog}
            />
            <CommitHistoryPanel
              commits={commits}
              expandedIds={expandedIds}
              expandedCommitDocuments={expandedCommitDocuments}
              loadingCommitDocuments={loadingCommitDocuments}
              selectedDocumentPath={selectedDocumentPath}
              selectedCommitId={selectedCommitId}
              onToggleExpand={toggleCommitExpansion}
              onSelectDocument={handleSelectCommitDocument}
            />
          </StackedResizablePanelsLayout>
        }
      >
        {documentChangeMatch ? (
          <Outlet
            context={
              {
                commits,
                expandedCommitDocuments,
                uncommittedChanges,
              } satisfies ProjectHistoryOutletContext
            }
          />
        ) : (
          <EmptyDetailView />
        )}
      </SidebarLayout>
      <CommitDialog
        isOpen={isCommitDialogOpen}
        onCancel={handleCancelCommitDialog}
        canCommit={uncommittedChanges.length > 0}
        onCommit={handleCommit}
      />
    </>
  );
};
