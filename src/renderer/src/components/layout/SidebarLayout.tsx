import { type ReactNode, useContext, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { SidebarLayoutContext } from '../../app-state';

export const SidebarLayout = ({
  sidebar,
  needsSidebar = false,
  children,
}: {
  sidebar: ReactNode;
  needsSidebar?: boolean;
  children: ReactNode;
}) => {
  const {
    isSidebarOpen,
    sidebarPanelRef,
    openSidebar,
    collapseSidebar,
    expandSidebar,
  } = useContext(SidebarLayoutContext);

  useEffect(() => {
    if (needsSidebar) openSidebar();
  }, [needsSidebar, openSidebar]);

  return (
    <PanelGroup autoSaveId="sidebar-layout-panel-group" direction="horizontal">
      <Panel
        ref={sidebarPanelRef}
        collapsible
        defaultSize={27}
        onCollapse={collapseSidebar}
        onExpand={expandSidebar}
      >
        {isSidebarOpen && (
          <div className="h-full overflow-y-auto border-r border-gray-300 dark:border-neutral-600">
            {sidebar}
          </div>
        )}
      </Panel>
      <PanelResizeHandle />
      <Panel className="flex">{children}</Panel>
    </PanelGroup>
  );
};
