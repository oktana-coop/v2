import { createContext, useEffect, useState } from 'react';

import { type Theme, themes } from './theme';

const getDefaultTheme = () =>
  (localStorage.getItem('theme') ?? themes.light) as Theme;

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: getDefaultTheme(),
  // This is a placeholder. It will be properly implemented in the provider below.
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getDefaultTheme());

  useEffect(() => {
    // set the theme in the body element
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(theme);
  }, [theme]);

  const handleSetTheme = (theme: Theme) => {
    localStorage.setItem('theme', theme);
    setTheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
