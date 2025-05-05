import { useRef } from 'react';

import { IconButton } from '../../components/actions/IconButton';
import {
  RevertIcon,
  SidebarIcon,
  SidebarOpenIcon,
} from '../../components/icons';

export const ActionsBar = ({
  isSidebarOpen,
  onSidebarToggle,
  onRevertIconClick,
}: {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onRevertIconClick: () => void;
}) => {
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSidebarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    console.log('in handleSidebarToggle');
    onSidebarToggle();

    // manually remove the hover state because headless-ui doesn't handle it properly in this case
    if (sidebarButtonRef.current) {
      sidebarButtonRef.current.removeAttribute('data-headlessui-state');
      sidebarButtonRef.current.removeAttribute('data-hover');
    }
  };

  const handleRevertIconClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onRevertIconClick();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
      <div className="flex flex-initial items-center gap-2">
        <IconButton onClick={handleRevertIconClick} icon={<RevertIcon />} />
      </div>
    </div>
  );
};
