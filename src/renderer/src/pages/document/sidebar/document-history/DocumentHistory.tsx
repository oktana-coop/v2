import { useContext } from 'react';

import {
  type Commit,
  type UncommitedChange,
} from '../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../app-state';
import { CommitHistoryIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { ChangeLog, ChangeLogSkeleton } from './change-log';
import { EmptyView } from './EmptyView';

export type DocumentHistoryPanelProps = {
  commits: (Commit | UncommitedChange)[];
  onCommitClick: (heads: Commit['heads']) => void;
  selectedCommit: Commit['heads'] | null;
};

const DocumentHistoryContent = ({
  commits,
  onCommitClick,
  selectedCommit,
}: DocumentHistoryPanelProps) => {
  const { loadingHistory } = useContext(CurrentDocumentContext);

  if (loadingHistory) {
    return <ChangeLogSkeleton />;
  }

  if (commits.length === 0) {
    return <EmptyView />;
  }

  return (
    <ChangeLog
      changes={commits}
      onClick={onCommitClick}
      selectedCommit={selectedCommit}
    />
  );
};

export const DocumentHistory = ({
  commits,
  onCommitClick,
  selectedCommit,
}: DocumentHistoryPanelProps) => {
  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={CommitHistoryIcon} text="Document History" />
        </div>
      </div>
      <div className="flex h-full flex-col items-stretch overflow-auto">
        <DocumentHistoryContent
          commits={commits}
          onCommitClick={onCommitClick}
          selectedCommit={selectedCommit}
        />
      </div>
    </div>
  );
};
