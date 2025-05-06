import { createContext, useState } from 'react';

const SHOW_DIFF_IN_HISTORY_VIEW_KEY = 'showDiffInHistoryView';

type FunctionalityConfigContextType = {
  showDiffInHistoryView: boolean;
  setShowDiffInHistoryView: (value: boolean) => void;
};

export const FunctionalityConfigContext =
  createContext<FunctionalityConfigContextType>({
    showDiffInHistoryView: true,
    setShowDiffInHistoryView: () => {},
  });

export const FunctionalityConfigProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [showDiffInHistoryView, setShowDiffInHistoryView] = useState(
    localStorage.getItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY) === 'true'
  );

  const handleToggleShowDiffInHistoryView = (value: boolean) => {
    localStorage.setItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY, value.toString());
    setShowDiffInHistoryView(value);
  };

  return (
    <FunctionalityConfigContext.Provider
      value={{
        showDiffInHistoryView,
        setShowDiffInHistoryView: handleToggleShowDiffInHistoryView,
      }}
    >
      {children}
    </FunctionalityConfigContext.Provider>
  );
};
