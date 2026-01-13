import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { CompareContentConflict as CompareContentConflictType } from '../../../../../../../modules/infrastructure/version-control';
import { SidebarLayoutContext } from '../../../../../app-state';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import { useMergeConflictInfo } from '../../../../../hooks';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';
import { CompareContentConflict } from './CompareContentConflict';

export const CompareContentConflictResolution = () => {
  const { compareContentPath } = useParams();
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { mergeConflictInfo, compareContentConflicts } = useMergeConflictInfo();
  const [conflict, setConflict] = useState<CompareContentConflictType | null>(
    null
  );

  useEffect(() => {
    const selectedConflict = compareContentConflicts.find(
      (conf) => conf.path === compareContentPath
    );
    setConflict(selectedConflict ?? null);
  }, [compareContentConflicts, compareContentPath]);

  if (!mergeConflictInfo) {
    return null;
  }

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          mergeConflictInfo={mergeConflictInfo}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onAbortMerge={() => {}}
          onResolveConflict={() => {}}
        />
      </div>
      <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-16">
        {conflict ? (
          <CompareContentConflict
            conflict={conflict}
            mergeConflictInfo={mergeConflictInfo}
          />
        ) : (
          <LongTextSkeleton />
        )}
      </div>
    </div>
  );
};
