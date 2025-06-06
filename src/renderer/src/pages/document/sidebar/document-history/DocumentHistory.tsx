import {
  type Commit,
  type UncommitedChange,
} from '../../../../../../modules/infrastructure/version-control';
import { CommitHistoryIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

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
  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={CommitHistoryIcon} text="Document History" />
        </div>
      </div>
      <div className="overflow-auto">
        <ChangeLog
          changes={commits}
          onClick={onCommitClick}
          selectedCommit={selectedCommit}
        />
      </div>
    </div>
  );
};
