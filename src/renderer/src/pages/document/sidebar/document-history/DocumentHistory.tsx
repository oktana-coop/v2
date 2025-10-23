import { useContext } from 'react';

import {
  type Commit,
  type UncommitedChange,
} from '../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../app-state';
import { CommitHistoryIcon } from '../../../../components/icons';
import { LoadingText } from '../../../../components/progress/LoadingText';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';
import { EmptyView } from './EmptyView';

export type DocumentHistoryPanelProps = {
  commits: (Commit | UncommitedChange)[];
  onCommitClick: (heads: Commit['heads']) => void;
  selectedCommit: Commit['heads'] | null;
};

export const DocumentHistory = ({
  commits,
  onCommitClick,
  selectedCommit,
}: DocumentHistoryPanelProps) => {
  const { loadingHistory } = useContext(CurrentDocumentContext);

  if (loadingHistory) {
    return <LoadingText />;
  }

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={CommitHistoryIcon} text="Document History" />
        </div>
      </div>
      <div className="flex h-full flex-col items-stretch overflow-auto">
        {commits.length > 0 ? (
          <ChangeLog
            changes={commits}
            onClick={onCommitClick}
            selectedCommit={selectedCommit}
          />
        ) : (
          <EmptyView />
        )}
      </div>
    </div>
  );
};
