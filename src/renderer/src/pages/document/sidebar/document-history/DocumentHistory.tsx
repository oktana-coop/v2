import { useContext } from 'react';

import { type Change } from '../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../app-state';
import { CommitHistoryIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { ChangeLog, ChangeLogSkeleton } from './change-log';
import { EmptyView } from './EmptyView';

export type DocumentHistoryPanelProps = {
  changes: Change[];
  onChangeClick: (changeId: Change['id']) => void;
  selectedChange: Change['id'] | null;
};

const DocumentHistoryContent = ({
  changes,
  onChangeClick,
  selectedChange,
}: DocumentHistoryPanelProps) => {
  const { versionedDocumentId, loadingHistory } = useContext(
    CurrentDocumentContext
  );

  if (loadingHistory) {
    return <ChangeLogSkeleton />;
  }

  if (!versionedDocumentId || changes.length === 0) {
    return <EmptyView />;
  }

  return (
    <ChangeLog
      changes={changes}
      onClick={onChangeClick}
      selectedChange={selectedChange}
    />
  );
};

export const DocumentHistory = ({
  changes,
  onChangeClick,
  selectedChange,
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
          changes={changes}
          onChangeClick={onChangeClick}
          selectedChange={selectedChange}
        />
      </div>
    </div>
  );
};
