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
import { useState } from 'react';

const NoMatchingResults = () => {
  return (
    <div className="px-6 py-14 text-center sm:px-14">
      <p className="mt-4 text-sm text-gray-900 dark:text-gray-300">
        No matching documents or actions found.
      </p>
    </div>
  );
};

function isDocumentOption(
  option: DocumentOption | ActionOption | null | undefined
): option is DocumentOption {
  if (option) {
    return (option as DocumentOption).onDocumentSelection !== undefined;
  }
  return false;
}

type DocumentOption = {
  id: string;
  title: string;
  onDocumentSelection: () => void;
};
type ActionOption = {
  name: string;
  shortcut?: string;
  onActionSelection: () => void;
};

export type CommandPaletteProps = {
  open?: boolean;
  onClose: () => void;
  documentsGroupTitle: string;
  documents?: Array<DocumentOption>;
  actions?: Array<ActionOption>;
};

export const CommandPalette = ({
  open = false,
  onClose,
  documentsGroupTitle,
  documents,
  actions,
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('');

  const filteredDocuments =
    query === ''
      ? documents || []
      : (documents || []).filter((document) => {
          return document.title.toLowerCase().includes(query.toLowerCase());
        });

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
            onChange={(option: DocumentOption | ActionOption) => {
              onClose();
              if (isDocumentOption(option)) {
                option.onDocumentSelection();
              } else {
                option.onActionSelection();
              }
              setQuery('');
            }}
          >
            <div className="grid grid-cols-1">
              <ComboboxInput
                autoFocus
                className="col-start-1 row-start-1 h-12 w-full bg-transparent p-4 text-base text-gray-900 outline-none placeholder:text-gray-500 sm:text-sm dark:text-gray-100 dark:placeholder:text-gray-300"
                placeholder="Search..."
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onBlur={() => {
                  setQuery('');
                }}
              />
            </div>

            <ComboboxOptions
              static
              as="ul"
              className="max-h-80 scroll-py-2 divide-y divide-gray-500/10 overflow-y-auto"
            >
              {filteredDocuments.length > 0 && (
                <li className="p-4">
                  {documentsGroupTitle && (
                    <h2 className="mb-2 mt-4 text-xs font-semibold text-gray-900 dark:text-gray-300">
                      {documentsGroupTitle}
                    </h2>
                  )}
                  <ul className="text-sm text-gray-700 dark:text-gray-400">
                    {filteredDocuments.map((project) => (
                      <ComboboxOption
                        as="li"
                        key={project.id}
                        value={project}
                        className="group flex cursor-default select-none items-center rounded-md px-2 py-2 data-[focus]:bg-gray-900/5 data-[focus]:text-gray-900 data-[focus]:outline-none dark:data-[focus]:bg-gray-300/5 dark:data-[focus]:text-gray-100"
                      >
                        <span className="flex-auto truncate">
                          {project.title}
                        </span>
                        <span className="hidden flex-none text-gray-500 group-data-[focus]:inline">
                          Jump to...
                        </span>
                      </ComboboxOption>
                    ))}
                  </ul>
                </li>
              )}
              {filteredActions.length > 0 && (
                <li className="p-4">
                  <h2 className="sr-only">Quick actions</h2>
                  <ul className="text-sm text-gray-700 dark:text-gray-400">
                    {filteredActions.map((action) => (
                      <ComboboxOption
                        as="li"
                        key={action.name}
                        value={action}
                        className="group flex cursor-default select-none items-center rounded-md px-2 py-2 data-[focus]:bg-gray-900/5 data-[focus]:text-gray-900 data-[focus]:outline-none dark:data-[focus]:bg-gray-300/5 dark:data-[focus]:text-gray-100"
                      >
                        <span className="flex-auto truncate">
                          {action.name}
                        </span>
                        {action.shortcut && (
                          <span className="flex-none text-xs font-semibold text-gray-500 dark:text-gray-400">
                            <kbd className="font-sans">⌘</kbd>
                            <kbd className="font-sans">{action.shortcut}</kbd>
                          </span>
                        )}
                      </ComboboxOption>
                    ))}
                  </ul>
                </li>
              )}
            </ComboboxOptions>

            {query !== '' &&
              [...filteredDocuments, ...filteredActions].length === 0 && (
                <NoMatchingResults />
              )}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
