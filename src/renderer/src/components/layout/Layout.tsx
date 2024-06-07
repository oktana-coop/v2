import clsx from 'clsx';
import { useContext, type ReactNode } from 'react';

import { NavBar } from '../navigation/NavBar';
import { ThemeContext, themes } from '../../personalization/theme';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { theme } = useContext(ThemeContext);

  const themeStyles =
    theme === themes.dark
      ? 'dark bg-neutral-800 text-white'
      : 'light bg-[#fafafa] text-black';

  return (
    <div className={clsx('flex h-full', themeStyles)}>
      <NavBar />
      {children}
    </div>
  );
};
