import { useContext } from 'react';

import {
  isFileDirectoryConflict,
  isModifyDeleteConflict,
  isRenameAddConflict,
  isRenameDeleteConflict,
  isRenameRenameConflict,
  isSubmoduleConflict,
  type StructuralConflict as StructuralConflictType,
} from '../../../../../../../modules/infrastructure/version-control';
import { SidebarLayoutContext } from '../../../../../app-state';
import { DiffIcon } from '../../../../../components/icons';
import { useMergeConflictResolution } from '../../../../../hooks';
import { SectionHeader } from '../../../../shared/settings/SectionHeader';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';
import { StructuralConflict } from './StructuralConflict';

export const StructuralConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { mergeConflictInfo, structuralConflicts, abortMerge } =
    useMergeConflictResolution();

  if (!mergeConflictInfo) {
    return null;
  }

  const getConflictKey = (conflict: StructuralConflictType) => {
    if (isModifyDeleteConflict(conflict)) {
      return `modify-delete-${conflict.path}`;
    }

    if (isFileDirectoryConflict(conflict)) {
      return `file-directory-${conflict.filePath}-${conflict.directoryPath}`;
    }

    if (isRenameRenameConflict(conflict)) {
      return `rename-rename-${conflict.basePath}-${conflict.sourcePath}-${conflict.targetPath}`;
    }

    if (isRenameDeleteConflict(conflict)) {
      return `rename-delete-${conflict.renamedPath}`;
    }

    if (isRenameAddConflict(conflict)) {
      return `rename-add-${conflict.renamedPath}`;
    }

    if (isSubmoduleConflict(conflict)) {
      return `submodule-${conflict.path}`;
    }
  };

  const handleAbortMerge = () => {
    abortMerge();
  };

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          mergeConflictInfo={mergeConflictInfo}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onAbortMerge={handleAbortMerge}
          hasResolveConflictButton={false}
          hasEditorToolbarToggle={false}
          hasShowDiffCheckbox={false}
        />
      </div>
      <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-16">
        <div className="text-left">
          <SectionHeader icon={DiffIcon} heading="File Changes" />
          <p className="mb-6">
            Some files have changes that conflict across branches. Please decide
            what should happen to each file before merging content.
          </p>
          {structuralConflicts.map((conflict) => (
            <StructuralConflict
              key={getConflictKey(conflict)}
              conflict={conflict}
              mergeConflictInfo={mergeConflictInfo}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
