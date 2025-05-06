import { createContext, useEffect, useState } from 'react';

import { type Theme, themes } from './theme';

const SHOW_DIFF_IN_HISTORY_VIEW_KEY = 'showDiffInHistoryView';

const getDefaultTheme = () =>
  (localStorage.getItem('theme') ?? themes.light) as Theme;

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  showDiffInHistoryView: boolean;
  setShowDiffInHistoryView: (value: boolean) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: getDefaultTheme(),
  // This is a placeholder. It will be properly implemented in the provider below.
  setTheme: () => {},
  showDiffInHistoryView: true,
  setShowDiffInHistoryView: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getDefaultTheme());
  const [showDiffInHistoryView, setShowDiffInHistoryView] = useState(
    localStorage.getItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY) === 'true'
  );

  useEffect(() => {
    // set the theme in the body element
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(theme);
  }, [theme]);

  const handleSetTheme = (theme: Theme) => {
    localStorage.setItem('theme', theme);
    setTheme(theme);
  };

  const handleToggleShowDiffInHistoryView = (value: boolean) => {
    localStorage.setItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY, value.toString());
    setShowDiffInHistoryView(value);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: handleSetTheme,
        showDiffInHistoryView,
        setShowDiffInHistoryView: handleToggleShowDiffInHistoryView,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
