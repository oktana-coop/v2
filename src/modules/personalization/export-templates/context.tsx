import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../infrastructure/cross-platform/browser';
import {
  DEFAULT_TEMPLATE_ID,
  defaultExportTemplate,
  defaultExportTemplatePreferences,
  type ExportTemplate,
  type ExportTemplatePreferences,
  parseExportTemplatePreferences,
} from './models';

const ACTIVE_TEMPLATE_ID_KEY = 'exports.activeTemplateId';
const TEMPLATES_KEY = 'exports.templates';

const parseStoredPreferences = (data: unknown): ExportTemplatePreferences =>
  Effect.runSync(
    pipe(
      parseExportTemplatePreferences(data),
      Effect.catchAll(() => Effect.succeed(defaultExportTemplatePreferences))
    )
  );

const getLocalStoragePreferences = (): ExportTemplatePreferences => {
  const storedId = localStorage.getItem(ACTIVE_TEMPLATE_ID_KEY);
  const storedTemplates = localStorage.getItem(TEMPLATES_KEY);

  if (!storedTemplates) return defaultExportTemplatePreferences;

  try {
    return parseStoredPreferences({
      activeTemplateId:
        storedId ?? defaultExportTemplatePreferences.activeTemplateId,
      templates: JSON.parse(storedTemplates),
    });
  } catch {
    return defaultExportTemplatePreferences;
  }
};

export type ExportTemplatesContextType = {
  templates: ExportTemplate[];
  activeTemplateId: string;
  activeTemplate: ExportTemplate;
  setActiveTemplateId: (id: string) => void;
  addTemplate: (template: ExportTemplate) => void;
  updateTemplate: (template: ExportTemplate) => void;
  deleteTemplate: (id: string) => void;
};

export const ExportTemplatesContext = createContext<ExportTemplatesContextType>(
  {
    templates: defaultExportTemplatePreferences.templates,
    activeTemplateId: DEFAULT_TEMPLATE_ID,
    activeTemplate: defaultExportTemplate,
    setActiveTemplateId: () => {},
    addTemplate: () => {},
    updateTemplate: () => {},
    deleteTemplate: () => {},
  }
);

const findActiveTemplate = (
  templates: ExportTemplate[],
  activeTemplateId: string
): ExportTemplate =>
  templates.find((t) => t.id === activeTemplateId) ?? defaultExportTemplate;

export const ExportTemplatesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [preferences, setPreferences] = useState(getLocalStoragePreferences);
  const { isElectron } = useContext(ElectronContext);

  useEffect(() => {
    const loadFromMain = async () => {
      const stored = await window.personalizationAPI.getExportTemplates();
      if (stored) {
        setPreferences(parseStoredPreferences(stored));
      }
    };

    if (isElectron) {
      loadFromMain();
    }
  }, [isElectron]);

  const persistAndSync = (updated: ExportTemplatePreferences) => {
    setPreferences(updated);
    localStorage.setItem(ACTIVE_TEMPLATE_ID_KEY, updated.activeTemplateId);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated.templates));
    if (isElectron) {
      window.personalizationAPI.setExportTemplates(updated);
    }
  };

  const handleSetActiveTemplateId = (id: string) => {
    persistAndSync({ ...preferences, activeTemplateId: id });
  };

  const handleAddTemplate = (template: ExportTemplate) => {
    persistAndSync({
      ...preferences,
      templates: [...preferences.templates, template],
    });
  };

  const handleUpdateTemplate = (template: ExportTemplate) => {
    persistAndSync({
      ...preferences,
      templates: preferences.templates.map((t) =>
        t.id === template.id ? template : t
      ),
    });
  };

  const handleDeleteTemplate = (id: string) => {
    if (id === DEFAULT_TEMPLATE_ID) return;

    const updatedTemplates = preferences.templates.filter((t) => t.id !== id);
    const activeId =
      preferences.activeTemplateId === id
        ? DEFAULT_TEMPLATE_ID
        : preferences.activeTemplateId;

    persistAndSync({
      activeTemplateId: activeId,
      templates: updatedTemplates,
    });
  };

  const activeTemplate = findActiveTemplate(
    preferences.templates,
    preferences.activeTemplateId
  );

  return (
    <ExportTemplatesContext.Provider
      value={{
        templates: preferences.templates,
        activeTemplateId: preferences.activeTemplateId,
        activeTemplate,
        setActiveTemplateId: handleSetActiveTemplateId,
        addTemplate: handleAddTemplate,
        updateTemplate: handleUpdateTemplate,
        deleteTemplate: handleDeleteTemplate,
      }}
    >
      {children}
    </ExportTemplatesContext.Provider>
  );
};
