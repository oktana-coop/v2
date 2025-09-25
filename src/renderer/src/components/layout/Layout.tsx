import { type ReactNode } from 'react';

import { NavBar } from '../navigation/NavBar';
import { Notifications } from '../notifications/Notifications';

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-full bg-[#fafafa] text-black dark:bg-neutral-800 dark:text-white">
    <NavBar />
    {children}
    <Notifications />
    {/* container for popovers, useful for not being constrained by component 
      hierarchy in the z axis. Meant to be used with React's `createPortal` */}
    <div id="popover-container" />
  </div>
);
