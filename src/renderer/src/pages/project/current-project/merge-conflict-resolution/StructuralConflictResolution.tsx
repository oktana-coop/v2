import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../app-state';
import { DiffIcon } from '../../../../components/icons';
import { useMergeConflictInfo } from '../../../../hooks';
import { SectionHeader } from '../../../shared/settings/SectionHeader';
import { MergeConflictResolutionActionsBar } from './ActionsBar';
import { StructuralConflict } from './structural/StructuralConflict';

export const StructuralConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { mergeConflictInfo, structuralConflicts } = useMergeConflictInfo();

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
    </div>
  );
};
