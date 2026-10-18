import { useContext, useRef } from 'react';

import { SidebarLayoutContext } from '../../../app-state';
import { IconButton } from '../../../components/actions/IconButton';
import { SidebarIcon, SidebarOpenIcon } from '../../../components/icons';

export const SidebarToggleButton = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    toggleSidebar();

    // manually remove the hover state because headless-ui doesn't handle it properly in this case
    if (buttonRef.current) {
      buttonRef.current.removeAttribute('data-headlessui-state');
      buttonRef.current.removeAttribute('data-hover');
    }
  };

  return (
    <IconButton
      ref={buttonRef}
      icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
      tooltip={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
      onClick={handleClick}
    />
  );
};
