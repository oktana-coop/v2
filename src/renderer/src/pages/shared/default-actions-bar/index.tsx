import { useRef } from 'react';

import { IconButton } from '../../../components/actions/IconButton';
import { SidebarIcon, SidebarOpenIcon } from '../../../components/icons';

export const DefaultActionsBar = ({
  isSidebarOpen,
  onSidebarToggle,
}: {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
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

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
    </div>
  );
};
