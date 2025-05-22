import { type ReactNode, useContext } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { SidebarLayoutContext } from '../../../../modules/editor-state/sidebar-layout/context';

export const SidebarLayout = ({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) => {
  const { isSidebarOpen, sidebarPanelRef, collapseSidebar, expandSidebar } =
    useContext(SidebarLayoutContext);

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
