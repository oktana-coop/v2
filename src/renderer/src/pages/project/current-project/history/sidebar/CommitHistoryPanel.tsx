import {
  type ChangedDocument,
  changeIdsAreSame,
  type Commit,
  urlEncodeChangeId,
} from '../../../../../../../modules/infrastructure/version-control';
import { CommitHistoryIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { ProjectCommitRow } from './ProjectCommitRow';

export const CommitHistoryPanel = ({
  commits,
  expandedIds,
  expandedCommitDocuments,
  loadingCommitDocuments,
  selectedDocumentPath,
  selectedCommitId,
  onToggleExpand,
  onSelectDocument,
}: {
  commits: Commit[];
  expandedIds: Set<string>;
  expandedCommitDocuments: Record<string, ChangedDocument[]>;
  loadingCommitDocuments: Set<string>;
  selectedDocumentPath: string | null;
  selectedCommitId: Commit['id'] | null;
  onToggleExpand: (commitId: Commit['id']) => void;
  onSelectDocument: (args: {
    document: ChangedDocument;
    commitId: Commit['id'];
  }) => void;
}) => {
  return (
    <div
      className="flex h-full flex-col overflow-hidden py-6"
      data-testid="commit-history-panel"
    >
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={CommitHistoryIcon} text="Commit History" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {commits.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p>No commits yet</p>
          </div>
        ) : (
          commits.map((commit, index) => {
            const key = urlEncodeChangeId(commit.id);
            const isDocumentSelected = (document: ChangedDocument) =>
              document.path === selectedDocumentPath &&
              selectedCommitId !== null &&
              changeIdsAreSame(commit.id, selectedCommitId);

            return (
              <ProjectCommitRow
                key={key}
                commit={commit}
                isFirst={index === 0}
                isLast={index === commits.length - 1}
                isExpanded={expandedIds.has(key)}
                changedDocuments={expandedCommitDocuments[key]}
                loadingDocuments={loadingCommitDocuments.has(key)}
                isDocumentSelected={isDocumentSelected}
                onToggleExpand={() => onToggleExpand(commit.id)}
                onSelectDocument={(document) =>
                  onSelectDocument({ document, commitId: commit.id })
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
};
