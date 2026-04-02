import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../infrastructure/cross-platform/browser';
import { bundledFonts, extractSystemFontFamilies } from '../font-families';
import { type AvailableFonts } from '../ui/context';
import {
  defaultEditorAppearance,
  type EditorAppearancePreferences,
} from './editor';

const HEADING_FONT_STORAGE_KEY = 'appearance.editor.headingFontFamily';
const BODY_FONT_STORAGE_KEY = 'appearance.editor.bodyFontFamily';

const getDefaultEditorAppearance = (): EditorAppearancePreferences => {
  const headingFontFamily = localStorage.getItem(HEADING_FONT_STORAGE_KEY);
  const bodyFontFamily = localStorage.getItem(BODY_FONT_STORAGE_KEY);
  return {
    headingFontFamily:
      headingFontFamily ?? defaultEditorAppearance.headingFontFamily,
    bodyFontFamily: bodyFontFamily ?? defaultEditorAppearance.bodyFontFamily,
  };
};

export type EditorAppearanceContextType = {
  editorAppearance: EditorAppearancePreferences;
  setEditorHeadingFontFamily: (fontFamily: string) => void;
  setEditorBodyFontFamily: (fontFamily: string) => void;
  availableFonts: AvailableFonts;
};

export const EditorAppearanceContext =
  createContext<EditorAppearanceContextType>({
    editorAppearance: getDefaultEditorAppearance(),
    setEditorHeadingFontFamily: () => {},
    setEditorBodyFontFamily: () => {},
    availableFonts: { bundled: bundledFonts, system: [] },
  });

const applyEditorFonts = (prefs: EditorAppearancePreferences) => {
  document.documentElement.style.setProperty(
    '--font-editor-heading',
    prefs.headingFontFamily
  );
  document.documentElement.style.setProperty(
    '--font-editor-body',
    prefs.bodyFontFamily
  );
};

const getSystemFonts = async (): Promise<string[]> => {
  if (typeof queryLocalFonts !== 'function') {
    return [];
  }

  try {
    return extractSystemFontFamilies({ fontData: await queryLocalFonts() });
  } catch {
    return [];
  }
};

export const EditorAppearanceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [editorAppearance, setEditorAppearance] = useState(
    getDefaultEditorAppearance
  );
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const { isElectron } = useContext(ElectronContext);

  useEffect(() => {
    const loadFromMain = async () => {
      const stored = await window.personalizationAPI.getEditorAppearance();
      if (stored) {
        setEditorAppearance(stored);
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
    applyEditorFonts(editorAppearance);
  }, [editorAppearance.headingFontFamily, editorAppearance.bodyFontFamily]);

  const persistAndSync = (updated: EditorAppearancePreferences) => {
    setEditorAppearance(updated);
    localStorage.setItem(HEADING_FONT_STORAGE_KEY, updated.headingFontFamily);
    localStorage.setItem(BODY_FONT_STORAGE_KEY, updated.bodyFontFamily);
    if (isElectron) {
      window.personalizationAPI.setEditorAppearance(updated);
    }
  };

  const handleSetHeadingFontFamily = (fontFamily: string) => {
    persistAndSync({ ...editorAppearance, headingFontFamily: fontFamily });
  };

  const handleSetBodyFontFamily = (fontFamily: string) => {
    persistAndSync({ ...editorAppearance, bodyFontFamily: fontFamily });
  };

  return (
    <EditorAppearanceContext.Provider
      value={{
        editorAppearance,
        setEditorHeadingFontFamily: handleSetHeadingFontFamily,
        setEditorBodyFontFamily: handleSetBodyFontFamily,
        availableFonts: { bundled: bundledFonts, system: systemFonts },
      }}
    >
      {children}
    </EditorAppearanceContext.Provider>
  );
};
