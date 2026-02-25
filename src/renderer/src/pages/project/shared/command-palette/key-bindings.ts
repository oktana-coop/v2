// here we define the key bindings for various commands in the application
// so we have them somewhere centralised and
// know where a key binding has already been taken
// and for what purpose

import type { KeyBinding } from '../../../../hooks/use-key-bindings';

// ctrl is used here to represent both ctrl (Windows/Linux) and cmd (Mac)
export const keyBindings: Record<
  string,
  { command: string; keyBinding: KeyBinding }
> = {
  ctrlShiftD: {
    command: 'Discard changes',
    keyBinding: 'ctrl+shift+d',
  },
  ctrlK: {
    command: 'Toggle command palette',
    keyBinding: 'ctrl+k',
  },
  ctrlO: {
    command: 'Open document',
    keyBinding: 'ctrl+o',
  },
  ctrlT: {
    command: 'Create a new document',
    keyBinding: 'ctrl+t',
  },
  ctrlS: {
    // aka save
    // as this is the "proper save" shortcut that allows you to save with context, hence commit
    // while the "simple save" (no context) is handled automatically. auto-save is always on.
    command: 'Commit changes',
    keyBinding: 'ctrl+s',
  },
  ctrlShiftM: {
    command: 'Export to Markdown',
    keyBinding: 'ctrl+shift+m',
  },
  ctrlShiftH: {
    command: 'Export to HTML',
    keyBinding: 'ctrl+shift+h',
  },
  ctrlShiftW: {
    command: 'Export to Docx (Microsoft Word)',
    keyBinding: 'ctrl+shift+w',
  },
  ctrlAltF: {
    command: 'Insert footnote',
    keyBinding: 'ctrl+alt+f',
  },
  ctrlComma: {
    command: 'Open Project Settings',
    keyBinding: 'ctrl+,',
  },
} as const;
