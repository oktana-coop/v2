'use client';
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from '@headlessui/react';
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useKeyBindings } from '../../../hooks';
import { FileDocumentIcon } from '../../icons';
import { type IconProps } from '../../icons/types';

export const NoMatchingResults = () => {
  return (
    <div className="px-6 py-14 text-center sm:px-14">
      <p className="mt-4 text-sm text-gray-900 dark:text-gray-300">
        No matching documents or actions found.
      </p>
    </div>
  );
};

function isDocumentOption(
  option: DocumentOption | ActionOption
): option is DocumentOption {
  if (option) {
    return (option as DocumentOption).onDocumentSelection !== undefined;
  }
  return false;
}

export type DocumentOption = {
  id?: string;
  title: string;
  onDocumentSelection: () => void;
  icon?: React.ComponentType<IconProps>;
};

export type ActionOption = {
  name: string;
  shortcut?: string;
  onActionSelection: () => void;
  icon?: React.ComponentType<IconProps>;
};

export type CommandPaletteOption = DocumentOption | ActionOption;

export type CommandPaletteProps = {
  open?: boolean;
  onClose: () => void;
  documentsGroupTitle?: string;
  contextualSection?: {
    groupTitle: string;
    actions: Array<ActionOption>;
  };
  documents?: Array<DocumentOption>;
  actions?: Array<ActionOption>;
};

export const CommandPaletteInput = ({
  placeholder,
  onChange,
  onBlur,
}: {
  placeholder: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: React.FocusEventHandler<HTMLInputElement> | undefined;
}) => (
  <ComboboxInput
    autoFocus
    className="col-start-1 row-start-1 h-12 w-full bg-transparent p-4 text-base text-gray-900 outline-none placeholder:text-gray-500 sm:text-sm dark:text-gray-100 dark:placeholder:text-gray-300"
    placeholder={placeholder}
    onChange={onChange}
    onBlur={onBlur}
  />
);

export const CommandPaletteSectionTitle = ({ title }: { title: string }) => (
  <h2 className="px-4 py-2 text-xs font-semibold text-gray-900 dark:text-gray-300">
    {title}
  </h2>
);

export const CommandPaletteListSection = ({
  title,
  children,
}: {
  title?: string | React.ReactNode;
  children: React.ReactNode;
}) => (
  <li className="py-2">
    {typeof title === 'string' ? (
      <CommandPaletteSectionTitle title={title} />
    ) : (
      title
    )}
    <ul className="text-sm text-gray-700 dark:text-gray-400">{children}</ul>
  </li>
);

export const CommandPaletteOptions = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <ComboboxOptions
    static
    as="ul"
    className="max-h-100 scroll-py-2 divide-y divide-gray-500/10 overflow-y-auto"
  >
    {children}
  </ComboboxOptions>
);

export const CommandPaletteOption = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: CommandPaletteOption;
  icon?: React.ComponentType<IconProps>;
}) => (
  <ComboboxOption
    as="li"
    value={value}
    className="group flex cursor-default select-none items-center px-4 py-3 data-[focus]:bg-gray-900/5 data-[focus]:text-gray-900 data-[focus]:outline-none dark:data-[focus]:bg-gray-300/5 dark:data-[focus]:text-gray-100"
  >
    {Icon && <Icon className="mr-1 text-gray-500 dark:text-gray-400" />}
    <span className="flex-auto truncate">{label}</span>

    {isDocumentOption(value) ? (
      <span className="hidden flex-none text-gray-500 group-data-[focus]:inline dark:text-gray-400">
        Jump to...
      </span>
    ) : (
      // Action Option
      value.shortcut && (
        <span className="flex-none text-xs font-semibold text-gray-500 dark:text-gray-400">
          <kbd className="font-sans">⌘</kbd>
          <kbd className="font-sans">{value.shortcut}</kbd>
        </span>
      )
    )}
  </ComboboxOption>
);

export const CommandPalette = ({
  open = false,
  onClose,
  documentsGroupTitle,
  documents,
  actions = [],
  contextualSection,
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const allActions = [...actions, ...(contextualSection?.actions || [])];
  const actionsKeyBindings = allActions
    .filter((action) => action.shortcut)
    .map((action) => ({
      [`ctrl+${action.shortcut!.toLowerCase()}`]: action.onActionSelection,
    }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});
  useKeyBindings(actionsKeyBindings);

  const filteredDocuments =
    query === ''
      ? documents || []
      : (documents || []).filter((document) => {
          return document.title.toLowerCase().includes(query.toLowerCase());
        });

  const filteredContextualActions = contextualSection
    ? (contextualSection.actions || []).filter((actions) => {
        return actions.name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  const filteredActions =
    query === ''
      ? actions || []
      : (actions || []).filter((action) => {
          return action.name.toLowerCase().includes(query.toLowerCase());
        });

  return (
    <Dialog
      className="relative z-10"
      open={open}
      onClose={() => {
        onClose();
        setQuery('');
      }}
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/25 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <DialogPanel
          transition
          className="mx-auto max-w-2xl transform divide-y divide-gray-500/10 overflow-hidden bg-white/80 shadow-2xl ring-1 ring-black/5 backdrop-blur backdrop-filter transition-all data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-zinc-900/80"
        >
          <Combobox
            onChange={(option: DocumentOption | ActionOption | null) => {
              if (option === null) return;
              onClose();
              setQuery('');
              if (isDocumentOption(option)) {
                option.onDocumentSelection();
              } else {
                // as the Command Palette dialog has a smooth transition out effect (see data-[leave]:duration-200 above)
                // we trigger the action selection after a short delay
                // so actions that came after the dialog closing can be executed timely.
                // specifically, this is useful for other dialogs (like the CommitDialog) to persist their input focus.
                setTimeout(() => option.onActionSelection(), 250);
              }
            }}
          >
            <div className="grid grid-cols-1">
              <CommandPaletteInput
                placeholder="Search..."
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onBlur={() => {
                  setQuery('');
                }}
              />
            </div>

            <CommandPaletteOptions>
              {contextualSection && filteredContextualActions.length > 0 && (
                <CommandPaletteListSection title={contextualSection.groupTitle}>
                  {filteredContextualActions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={action.name}
                      value={action}
                      icon={action.icon}
                    />
                  ))}
                </CommandPaletteListSection>
              )}
              {filteredDocuments.length > 0 && (
                <CommandPaletteListSection title={documentsGroupTitle}>
                  {filteredDocuments.map((project) => (
                    <CommandPaletteOption
                      key={project.id || uuidv4()}
                      label={project.title}
                      value={project}
                      icon={FileDocumentIcon}
                    />
                  ))}
                </CommandPaletteListSection>
              )}
              {filteredActions.length > 0 && (
                <CommandPaletteListSection
                  title={<h2 className="sr-only">Quick actions</h2>}
                >
                  {filteredActions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={action.name}
                      value={action}
                      icon={action.icon}
                    />
                  ))}
                </CommandPaletteListSection>
              )}
            </CommandPaletteOptions>
            {query !== '' &&
              [
                ...filteredDocuments,
                ...filteredActions,
                ...filteredContextualActions,
              ].length === 0 && <NoMatchingResults />}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
