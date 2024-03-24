import { createContext } from 'react';
import { type Theme } from './theme';
import { getDefaultTheme } from './default';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: getDefaultTheme(),
  // This is a placeholder. It will be properly implemented
  // in the main container that provides the context.
  setTheme: () => {},
});
