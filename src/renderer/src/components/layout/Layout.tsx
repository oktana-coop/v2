import { type ReactNode, useContext } from 'react';

import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import { NavBar } from '../navigation/NavBar';
import { Notifications } from '../notifications/Notifications';
import { MacTitleBar } from './MacTitleBar';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { isMac } = useContext(ElectronContext);

  return (
    <div className="flex h-full flex-col bg-[#fafafa] text-black dark:bg-neutral-800 dark:text-white">
      {isMac && <MacTitleBar />}
      <div className="flex flex-auto overflow-hidden">
        <NavBar />
        {children}
        <Notifications />
        {/* container for popovers, useful for not being constrained by component 
      hierarchy in the z axis. Meant to be used with React's `createPortal` */}
        <div id="popover-container" />
      </div>
    </div>
  );
};
