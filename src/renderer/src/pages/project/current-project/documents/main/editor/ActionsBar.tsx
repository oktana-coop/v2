import { useRef } from 'react';

import { IconButton } from '../../../../../../components/actions/IconButton';
import {
  CheckIcon,
  GroupIcon,
  SidebarIcon,
  SidebarOpenIcon,
  ToolbarToggleIcon,
  UserAddIcon,
} from '../../../../../../components/icons';

export const ActionsBar = ({
  isSidebarOpen,
  onSidebarToggle,
  onEditorToolbarToggle,
  isShared,
  onShareClick,
  canCommit,
  onCheckIconClick,
}: {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onEditorToolbarToggle: () => void;
  isShared: boolean;
  onShareClick: () => void;
  canCommit: boolean;
  onCheckIconClick: () => void;
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

  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle();
  };

  const handleShareClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onShareClick();
  };

  const handleCheckIconClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onCheckIconClick();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
      <div className="flex flex-initial items-center gap-2">
        <IconButton
          icon={<ToolbarToggleIcon />}
          onClick={handleToolbarToggle}
          tooltip="Toggle Toolbar"
        />
        <IconButton
          icon={isShared ? <GroupIcon /> : <UserAddIcon />}
          onClick={handleShareClick}
          tooltip={isShared ? 'Sharing Options' : 'Share Document'}
        />
        <IconButton
          onClick={handleCheckIconClick}
          icon={<CheckIcon />}
          color="purple"
          disabled={!canCommit}
          tooltip="Commit Changes"
        />
      </div>
    </div>
  );
};
