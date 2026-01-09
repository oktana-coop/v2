import { useRef } from 'react';

import { MergeConflictInfo } from '../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../components/actions/Button';
import { IconButton } from '../../../../components/actions/IconButton';
import { SidebarIcon, SidebarOpenIcon } from '../../../../components/icons';
import { MergePoles } from './MergePoles';

export const MergeConflictResolutionActionsBar = ({
  mergeConflictInfo,
  isSidebarOpen,
  onSidebarToggle,
  onAbortMerge,
  onResolveConflict,
}: {
  mergeConflictInfo: MergeConflictInfo;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onAbortMerge: () => void;
  onResolveConflict: () => void;
}) => {
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSidebarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onSidebarToggle();

    // manually remove the hover state because headless-ui doesn't handle it properly in this case
    if (sidebarButtonRef.current) {
      sidebarButtonRef.current.removeAttribute('data-headlessui-state');
      sidebarButtonRef.current.removeAttribute('data-hover');
    }
  };

  const handleAbortMerge = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onAbortMerge();
  };

  const handleResolveConflict = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onResolveConflict();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
      <h2 className="max-h-14 flex-auto overflow-y-hidden px-4 text-left text-base/7">
        Resolving merge conflicts:{' '}
        <MergePoles mergeConflictInfo={mergeConflictInfo} />
      </h2>
      <div className="flex flex-initial items-center gap-2">
        <Button
          color="purple"
          variant="outline"
          onClick={handleAbortMerge}
          size="sm"
        >
          Abort Merge
        </Button>
        <Button color="purple" onClick={handleResolveConflict} size="sm">
          Resolve Conflict
        </Button>
      </div>
    </div>
  );
};
