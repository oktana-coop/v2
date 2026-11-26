import { createContext, useContext } from 'react';

// What the form's fields use of the panel around it.
export type FormPanel = {
  focus: () => void;
  isEditHistoryKey: (event: KeyboardEvent) => boolean;
};

// Without a panel, a field is left by blurring it, and no key is the panel's.
export const FormPanelContext = createContext<FormPanel>({
  focus: () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  },
  isEditHistoryKey: () => false,
});

export const useFormPanel = (): FormPanel => useContext(FormPanelContext);
