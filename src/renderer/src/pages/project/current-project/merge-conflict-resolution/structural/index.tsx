import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../../app-state';
import { DiffIcon } from '../../../../../components/icons';
import { useMergeConflictInfo } from '../../../../../hooks';
import { SectionHeader } from '../../../../shared/settings/SectionHeader';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';

export const StructuralConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { structuralConflicts } = useMergeConflictInfo();

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onAbortMerge={() => {}}
          onResolveConflict={() => {}}
        />
      </div>
      <div className="text-left">
        <SectionHeader icon={DiffIcon} heading="Project Sync" />
        <p className="mb-6">
          Some files have changes that conflict across branches. Please decide
          what should happen to each file before merging content.
        </p>
        {structuralConflicts.map((conflict) => (
          <StructuralConflict conflict={conflict} />
        ))}
      </div>
    </div>
  );
};
