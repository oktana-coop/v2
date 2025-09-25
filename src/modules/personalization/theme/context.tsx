import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../infrastructure/cross-platform/electron-context';
import { type ResolvedTheme, type Theme, themes } from './theme';

const getDefaultTheme = () =>
  (localStorage.getItem('theme') ?? themes.light) as Theme;

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: ResolvedTheme | null; // This will be used if the theme is 'system'
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: getDefaultTheme(),
  resolvedTheme: null,
  // This is a placeholder. It will be properly implemented in the provider below.
  setTheme: () => {},
});

const getSystemTheme = async (isElectron: boolean) => {
  if (isElectron) {
    return window.personalizationAPI.getSystemTheme();
  }

  // Fallback for non-Electron environments (e.g., web)
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDarkMode ? themes.dark : themes.light;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getDefaultTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | null>(
    null
  );
  const { isElectron } = useContext(ElectronContext);

  useEffect(() => {
    const getThemeFromMain = async () => {
      const themeFromMain = await window.personalizationAPI.getTheme();
      setTheme(themeFromMain);
    };

    const unsubscribeFromThemeUpdates =
      window.personalizationAPI?.onSystemThemeUpdate((newTheme) => {
        setResolvedTheme(newTheme);
      });

    if (isElectron) {
      getThemeFromMain();
    }

    return () => {
      unsubscribeFromThemeUpdates?.();
    };
  }, [isElectron]);

  useEffect(() => {
    const updateResolvedTheme = async (newTheme: Theme) => {
      if (newTheme === themes.system) {
        const systemTheme = await getSystemTheme(isElectron);
        setResolvedTheme(systemTheme);
      } else {
        setResolvedTheme(newTheme);
      }
    };

    updateResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    const updateBodyThemeClass = async (resolvedTheme: ResolvedTheme) => {
      document.body.classList.remove('dark', 'light');
      document.body.classList.add(resolvedTheme);
    };

    if (resolvedTheme) {
      updateBodyThemeClass(resolvedTheme);
    }
  }, [resolvedTheme]);

  const handleSetTheme = (theme: Theme) => {
    localStorage.setItem('theme', theme);

    if (isElectron) {
      window.personalizationAPI.setTheme(theme);
    }

    setTheme(theme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme: handleSetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
