import { createContext } from 'react';
import { themes, type Theme } from './theme';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const getDefaultTheme = () =>
  (localStorage.getItem('theme') ?? themes.light) as Theme;

export const ThemeContext = createContext<ThemeContextType>({
  theme: getDefaultTheme(),
  // This is a placeholder. It will be properly implemented
  // in the main container that provides the context.
  setTheme: () => {},
});
