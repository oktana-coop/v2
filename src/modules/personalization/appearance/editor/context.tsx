import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../infrastructure/cross-platform/browser';
import {
  defaultExportTemplate,
  type ExportTemplate,
} from '../../export-templates';
import { ExportTemplatesContext } from '../../export-templates/context';
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
const MATCH_EXPORT_TEMPLATE_KEY = 'appearance.editor.matchExportTemplate';

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
  matchExportTemplate:
    localStorage.getItem(MATCH_EXPORT_TEMPLATE_KEY) === 'true',
});

export type EditorAppearanceContextType = {
  editorAppearance: EditorAppearancePreferences;
  setEditorHeadingFontFamily: (fontFamily: string) => void;
  setEditorHeadingFontWeight: (fontWeight: FontWeight) => void;
  setEditorHeadingTextSize: (textSize: HeadingTextSize) => void;
  setEditorBodyFontFamily: (fontFamily: string) => void;
  setMatchExportTemplate: (match: boolean) => void;
  availableFonts: AvailableFonts;
};

export const EditorAppearanceContext =
  createContext<EditorAppearanceContextType>({
    editorAppearance: getDefaultEditorAppearance(),
    setEditorHeadingFontFamily: () => {},
    setEditorHeadingFontWeight: () => {},
    setEditorHeadingTextSize: () => {},
    setEditorBodyFontFamily: () => {},
    setMatchExportTemplate: () => {},
    availableFonts: { bundled: bundledFonts, system: [] },
  });

const pt = (value: number) => `${value}pt`;

const templateCssVars = (template: ExportTemplate): Record<string, string> => {
  const { styles } = template;
  const headingKeys = [
    'heading1',
    'heading2',
    'heading3',
    'heading4',
    'heading5',
    'heading6',
  ] as const;

  return {
    '--editor-link-color': styles.link.color,
    '--editor-link-decoration': styles.link.textDecoration,
    '--editor-code-font': styles.inlineCode.fontFamily,
    '--editor-code-size': pt(styles.inlineCode.fontSize),
    '--editor-code-color': styles.inlineCode.color,
    '--editor-code-bg': styles.inlineCode.backgroundColor,
    '--editor-p-space-before': pt(styles.paragraph.spaceBefore),
    '--editor-p-space-after': pt(styles.paragraph.spaceAfter),
    '--editor-p-text-indent': pt(styles.paragraph.firstLineIndent),
    '--editor-ul-space-before': pt(styles.unorderedList.spaceBefore),
    '--editor-ul-space-after': pt(styles.unorderedList.spaceAfter),
    '--editor-ol-space-before': pt(styles.orderedList.spaceBefore),
    '--editor-ol-space-after': pt(styles.orderedList.spaceAfter),
    '--editor-blockquote-space-before': pt(styles.blockquote.spaceBefore),
    '--editor-blockquote-space-after': pt(styles.blockquote.spaceAfter),
    ...Object.fromEntries(
      headingKeys.flatMap((key) => {
        const level = key.replace('heading', '');
        return [
          [`--editor-h${level}-space-before`, pt(styles[key].spaceBefore)],
          [`--editor-h${level}-space-after`, pt(styles[key].spaceAfter)],
        ];
      })
    ),
  };
};

const applyTemplateStyles = (template: ExportTemplate) => {
  document.documentElement.classList.add('match-export');
  const vars = templateCssVars(template);
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
};

const templateCssVarKeys = Object.keys(templateCssVars(defaultExportTemplate));

const removeTemplateStyles = () => {
  document.documentElement.classList.remove('match-export');
  for (const key of templateCssVarKeys) {
    document.documentElement.style.removeProperty(key);
  }
};

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
  const { activeTemplate } = useContext(ExportTemplatesContext);

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
    if (editorAppearance.matchExportTemplate && activeTemplate) {
      applyEditorFonts({
        ...editorAppearance,
        headingFontFamily: activeTemplate.styles.heading1.fontFamily,
        headingFontWeight: activeTemplate.styles.heading1
          .fontWeight as FontWeight,
        bodyFontFamily: activeTemplate.styles.paragraph.fontFamily,
      });
      applyTemplateStyles(activeTemplate);
    } else {
      applyEditorFonts(editorAppearance);
      removeTemplateStyles();
    }
  }, [
    editorAppearance.headingFontFamily,
    editorAppearance.headingFontWeight,
    editorAppearance.headingTextSize,
    editorAppearance.bodyFontFamily,
    editorAppearance.matchExportTemplate,
    activeTemplate,
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
    localStorage.setItem(
      MATCH_EXPORT_TEMPLATE_KEY,
      String(updated.matchExportTemplate)
    );
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

  const handleSetMatchExportTemplate = (match: boolean) => {
    persistAndSync({ ...editorAppearance, matchExportTemplate: match });
  };

  return (
    <EditorAppearanceContext.Provider
      value={{
        editorAppearance,
        setEditorHeadingFontFamily: handleSetHeadingFontFamily,
        setEditorHeadingFontWeight: handleSetHeadingFontWeight,
        setEditorHeadingTextSize: handleSetHeadingTextSize,
        setEditorBodyFontFamily: handleSetBodyFontFamily,
        setMatchExportTemplate: handleSetMatchExportTemplate,
        availableFonts: { bundled: bundledFonts, system: systemFonts },
      }}
    >
      {children}
    </EditorAppearanceContext.Provider>
  );
};
