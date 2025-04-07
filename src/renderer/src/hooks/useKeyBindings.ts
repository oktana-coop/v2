import { useEffect } from 'react';

export const useKeyBindings = (keyBindings: {
  [keyboardEvent: string]: () => void;
}) => {
  useEffect(() => {
    const singleKeyBindings = Object.keys(keyBindings).filter((key) => {
      return !key.includes('+');
    });
    const metaKeyBindings = Object.keys(keyBindings).filter((key) => {
      return key.startsWith('ctrl+');
    });
    const metaShiftKeyBindings = Object.keys(keyBindings).filter((key) => {
      return key.startsWith('ctrl+shift+');
    });

    const handleGenericKeyDown = (event: KeyboardEvent) => {
      if (
        metaShiftKeyBindings
          .map((binding) => {
            return binding.split('ctrl+shift+').slice(1)[0];
          })
          .includes(event.key) &&
        (event.ctrlKey === true || event.metaKey === true) &&
        event.shiftKey === true
      ) {
        event.preventDefault();
        return keyBindings[`ctrl+shift+${event.key}`]();
      }

      if (
        metaKeyBindings
          .map((binding) => {
            return binding.split('ctrl+').slice(1)[0];
          })
          .includes(event.key) &&
        (event.ctrlKey === true || event.metaKey === true) &&
        event.shiftKey === false
      ) {
        event.preventDefault();
        return keyBindings[`ctrl+${event.key}`]();
      }

      if (singleKeyBindings.includes(event.key)) {
        event.preventDefault();
        return keyBindings[event.key]();
      }
    };

    window.addEventListener('keydown', handleGenericKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGenericKeyDown);
    };
  }, [keyBindings]);
};
