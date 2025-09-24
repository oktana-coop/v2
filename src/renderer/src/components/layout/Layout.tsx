import clsx from 'clsx';
import { type ReactNode, useContext } from 'react';

import {
  ThemeContext,
  themes,
} from '../../../../modules/personalization/theme';
import { NavBar } from '../navigation/NavBar';
import { Notifications } from '../notifications/Notifications';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { theme } = useContext(ThemeContext);

  const themeStyles =
    theme === themes.dark
      ? 'bg-neutral-800 text-white'
      : 'bg-[#fafafa] text-black';

  return (
    <div className={clsx('flex h-full', themeStyles)}>
      <NavBar />
      {children}
      <Notifications />
      {/* container for popovers, useful for not being constrained by component 
      hierarchy in the z axis. Meant to be used with React's `createPortal` */}
      <div id="popover-container" />
    </div>
  );
};
