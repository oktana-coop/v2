import { useContext, useRef } from 'react';

import { SidebarLayoutContext } from '../../app-state';
import { IconButton } from '../../components/actions/IconButton';
import { SidebarIcon, SidebarOpenIcon } from '../../components/icons';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';

export const SettingsActionsBar = ({ tabName }: { tabName: string }) => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSidebarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    toggleSidebar();

    if (sidebarButtonRef.current) {
      sidebarButtonRef.current.removeAttribute('data-headlessui-state');
      sidebarButtonRef.current.removeAttribute('data-hover');
    }
  };

  return (
    <div className="flex flex-initial items-center gap-2 px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
      {tabName && (
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: tabName },
          ]}
        />
      )}
    </div>
  );
};
