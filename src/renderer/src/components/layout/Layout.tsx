import clsx from 'clsx';
import { type ReactNode, useContext } from 'react';

import { ThemeContext, themes } from '../../modules/personalization/theme';
import { NavBar } from '../navigation/NavBar';

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
