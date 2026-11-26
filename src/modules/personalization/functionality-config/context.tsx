import { createContext, useState } from 'react';

const SHOW_DIFF_IN_HISTORY_VIEW_KEY = 'showDiffInHistoryView';
const SHOW_METADATA_KEY = 'showMetadata';
const SHOW_METADATA_AS_YAML_KEY = 'showMetadataAsYaml';

type FunctionalityConfigContextType = {
  showDiffInHistoryView: boolean;
  setShowDiffInHistoryView: (value: boolean) => void;
  showMetadata: boolean;
  setShowMetadata: (value: boolean) => void;
  showMetadataAsYaml: boolean;
  setShowMetadataAsYaml: (value: boolean) => void;
};

export const FunctionalityConfigContext =
  createContext<FunctionalityConfigContextType>({
    showDiffInHistoryView: true,
    setShowDiffInHistoryView: () => {},
    showMetadata: false,
    setShowMetadata: () => {},
    showMetadataAsYaml: false,
    setShowMetadataAsYaml: () => {},
  });

export const FunctionalityConfigProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [showDiffInHistoryView, setShowDiffInHistoryView] = useState(
    localStorage.getItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY) === 'true'
  );
  const [showMetadata, setShowMetadata] = useState(
    localStorage.getItem(SHOW_METADATA_KEY) === 'true'
  );
  const [showMetadataAsYaml, setShowMetadataAsYaml] = useState(
    localStorage.getItem(SHOW_METADATA_AS_YAML_KEY) === 'true'
  );

  const handleToggleShowDiffInHistoryView = (value: boolean) => {
    localStorage.setItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY, value.toString());
    setShowDiffInHistoryView(value);
  };

  const handleSetShowMetadata = (value: boolean) => {
    localStorage.setItem(SHOW_METADATA_KEY, value.toString());
    setShowMetadata(value);
  };

  const handleSetShowMetadataAsYaml = (value: boolean) => {
    localStorage.setItem(SHOW_METADATA_AS_YAML_KEY, value.toString());
    setShowMetadataAsYaml(value);
  };

  return (
    <FunctionalityConfigContext.Provider
      value={{
        showDiffInHistoryView,
        setShowDiffInHistoryView: handleToggleShowDiffInHistoryView,
        showMetadata,
        setShowMetadata: handleSetShowMetadata,
        showMetadataAsYaml,
        setShowMetadataAsYaml: handleSetShowMetadataAsYaml,
      }}
    >
      {children}
    </FunctionalityConfigContext.Provider>
  );
};
