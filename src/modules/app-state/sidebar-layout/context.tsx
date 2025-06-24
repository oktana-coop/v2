import { createContext, useCallback, useRef, useState } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';

export type SidebarLayoutContextType = {
  isSidebarOpen: boolean;
  sidebarPanelRef: React.MutableRefObject<ImperativePanelHandle | null>;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;
};

export const SidebarLayoutContext = createContext<SidebarLayoutContextType>({
  isSidebarOpen: true,
  sidebarPanelRef: { current: null },
  toggleSidebar: () => {},
  collapseSidebar: () => {},
  expandSidebar: () => {},
});

export const SidebarLayoutProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const sidebarPanelRef = useRef<ImperativePanelHandle | null>(null);

  const handleSidebarToggle = useCallback(() => {
    const sidebarPanel = sidebarPanelRef.current;
    if (!sidebarPanel) {
      return;
    }

    if (sidebarPanel.isExpanded()) {
      sidebarPanel.collapse();
    } else {
      sidebarPanel.expand();
    }
  }, [sidebarPanelRef]);

  const handleCollapseSidebar = () => {
    setSidebarOpen(false);
  };

  const handleExpandSidebar = () => {
    setSidebarOpen(true);
  };

  return (
    <SidebarLayoutContext.Provider
      value={{
        isSidebarOpen,
        sidebarPanelRef,
        toggleSidebar: handleSidebarToggle,
        collapseSidebar: handleCollapseSidebar,
        expandSidebar: handleExpandSidebar,
      }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
};
