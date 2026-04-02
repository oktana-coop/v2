import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../infrastructure/cross-platform/browser';
import { bundledFonts, extractSystemFontFamilies } from '../font-families';
import { type AvailableFonts } from '../ui/context';
import {
  defaultEditorAppearance,
  type EditorAppearancePreferences,
  type FontWeight,
  type HeadingTextSize,
  headingTextSizeScale,
} from './editor';

const HEADING_FONT_STORAGE_KEY = 'appearance.editor.headingFontFamily';
const HEADING_WEIGHT_STORAGE_KEY = 'appearance.editor.headingFontWeight';
const HEADING_TEXT_SIZE_STORAGE_KEY = 'appearance.editor.headingTextSize';
const BODY_FONT_STORAGE_KEY = 'appearance.editor.bodyFontFamily';

const getDefaultEditorAppearance = (): EditorAppearancePreferences => ({
  headingFontFamily:
    localStorage.getItem(HEADING_FONT_STORAGE_KEY) ??
    defaultEditorAppearance.headingFontFamily,
  headingFontWeight:
    (localStorage.getItem(HEADING_WEIGHT_STORAGE_KEY) as FontWeight) ??
    defaultEditorAppearance.headingFontWeight,
  headingTextSize:
    (localStorage.getItem(HEADING_TEXT_SIZE_STORAGE_KEY) as HeadingTextSize) ??
    defaultEditorAppearance.headingTextSize,
  bodyFontFamily:
    localStorage.getItem(BODY_FONT_STORAGE_KEY) ??
    defaultEditorAppearance.bodyFontFamily,
});

export type EditorAppearanceContextType = {
  editorAppearance: EditorAppearancePreferences;
  setEditorHeadingFontFamily: (fontFamily: string) => void;
  setEditorHeadingFontWeight: (fontWeight: FontWeight) => void;
  setEditorHeadingTextSize: (textSize: HeadingTextSize) => void;
  setEditorBodyFontFamily: (fontFamily: string) => void;
  availableFonts: AvailableFonts;
};

export const EditorAppearanceContext =
  createContext<EditorAppearanceContextType>({
    editorAppearance: getDefaultEditorAppearance(),
    setEditorHeadingFontFamily: () => {},
    setEditorHeadingFontWeight: () => {},
    setEditorHeadingTextSize: () => {},
    setEditorBodyFontFamily: () => {},
    availableFonts: { bundled: bundledFonts, system: [] },
  });

const applyEditorFonts = (prefs: EditorAppearancePreferences) => {
  document.documentElement.style.setProperty(
    '--font-editor-heading',
    prefs.headingFontFamily
  );
  document.documentElement.style.setProperty(
    '--font-editor-heading-weight',
    prefs.headingFontWeight
  );
  document.documentElement.style.setProperty(
    '--font-editor-heading-scale',
    headingTextSizeScale[prefs.headingTextSize]
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
  }, [
    editorAppearance.headingFontFamily,
    editorAppearance.headingFontWeight,
    editorAppearance.headingTextSize,
    editorAppearance.bodyFontFamily,
  ]);

  const persistAndSync = (updated: EditorAppearancePreferences) => {
    setEditorAppearance(updated);
    localStorage.setItem(HEADING_FONT_STORAGE_KEY, updated.headingFontFamily);
    localStorage.setItem(HEADING_WEIGHT_STORAGE_KEY, updated.headingFontWeight);
    localStorage.setItem(
      HEADING_TEXT_SIZE_STORAGE_KEY,
      updated.headingTextSize
    );
    localStorage.setItem(BODY_FONT_STORAGE_KEY, updated.bodyFontFamily);
    if (isElectron) {
      window.personalizationAPI.setEditorAppearance(updated);
    }
  };

  const handleSetHeadingFontFamily = (fontFamily: string) => {
    persistAndSync({ ...editorAppearance, headingFontFamily: fontFamily });
  };

  const handleSetHeadingFontWeight = (fontWeight: FontWeight) => {
    persistAndSync({ ...editorAppearance, headingFontWeight: fontWeight });
  };

  const handleSetHeadingTextSize = (textSize: HeadingTextSize) => {
    persistAndSync({ ...editorAppearance, headingTextSize: textSize });
  };

  const handleSetBodyFontFamily = (fontFamily: string) => {
    persistAndSync({ ...editorAppearance, bodyFontFamily: fontFamily });
  };

  return (
    <EditorAppearanceContext.Provider
      value={{
        editorAppearance,
        setEditorHeadingFontFamily: handleSetHeadingFontFamily,
        setEditorHeadingFontWeight: handleSetHeadingFontWeight,
        setEditorHeadingTextSize: handleSetHeadingTextSize,
        setEditorBodyFontFamily: handleSetBodyFontFamily,
        availableFonts: { bundled: bundledFonts, system: systemFonts },
      }}
    >
      {children}
    </EditorAppearanceContext.Provider>
  );
};
