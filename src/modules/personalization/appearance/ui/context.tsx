import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../infrastructure/cross-platform/browser';
import {
  bundledFonts,
  defaultUIAppearance,
  type UIAppearancePreferences,
} from './ui';

const UI_FONT_FAMILY_STORAGE_KEY = 'appearance.ui.fontFamily';

const getDefaultUIAppearance = (): UIAppearancePreferences => {
  const fontFamily = localStorage.getItem(UI_FONT_FAMILY_STORAGE_KEY);
  return fontFamily ? { fontFamily } : defaultUIAppearance;
};

export type AvailableFonts = {
  bundled: readonly string[];
  system: string[];
};

export type UIAppearanceContextType = {
  uiAppearance: UIAppearancePreferences;
  setUIFontFamily: (fontFamily: string) => void;
  availableFonts: AvailableFonts;
};

export const UIAppearanceContext = createContext<UIAppearanceContextType>({
  uiAppearance: getDefaultUIAppearance(),
  setUIFontFamily: () => {},
  availableFonts: { bundled: bundledFonts, system: [] },
});

const applyUIFont = (fontFamily: string) => {
  document.documentElement.style.setProperty('--font-ui', fontFamily);
};

const getSystemFonts = async (): Promise<string[]> => {
  if (typeof queryLocalFonts !== 'function') {
    return [];
  }

  try {
    const localFontData = await queryLocalFonts();
    const localFontFamilies = Array.from(
      new Set(localFontData.map((f) => f.family))
    ).sort();
    const bundledFontFamiliesSet = new Set<string>(bundledFonts);

    // Filter-out fonts that are also included in the bundled ones we include with the app.
    return localFontFamilies.filter(
      (family) => !bundledFontFamiliesSet.has(family)
    );
  } catch {
    return [];
  }
};

export const UIAppearanceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [uiAppearance, setUIAppearance] = useState(getDefaultUIAppearance);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const { isElectron } = useContext(ElectronContext);

  useEffect(() => {
    const loadFromMain = async () => {
      const stored = await window.personalizationAPI.getUIAppearance();
      if (stored) {
        setUIAppearance(stored);
      }
    };

    if (isElectron) {
      loadFromMain();
    }
  }, [isElectron]);

  useEffect(() => {
    const loadSystemFonts = async () => {
      const fonts = await getSystemFonts();
      setSystemFonts(fonts);
    };

    loadSystemFonts();
  }, []);

  useEffect(() => {
    applyUIFont(uiAppearance.fontFamily);
  }, [uiAppearance.fontFamily]);

  const handleSetUIFontFamily = (fontFamily: string) => {
    const updated: UIAppearancePreferences = { ...uiAppearance, fontFamily };
    setUIAppearance(updated);

    localStorage.setItem(UI_FONT_FAMILY_STORAGE_KEY, updated.fontFamily);
    if (isElectron) {
      window.personalizationAPI.setUIAppearance(updated);
    }
  };

  return (
    <UIAppearanceContext.Provider
      value={{
        uiAppearance,
        setUIFontFamily: handleSetUIFontFamily,
        availableFonts: { bundled: bundledFonts, system: systemFonts },
      }}
    >
      {children}
    </UIAppearanceContext.Provider>
  );
};
