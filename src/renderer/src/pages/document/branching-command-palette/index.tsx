import { Combobox, Dialog, DialogPanel } from '@headlessui/react';
import { useEffect, useState } from 'react';

import { type Branch } from '../../../../../modules/infrastructure/version-control';
import {
  type ActionOption,
  CommandPaletteInput,
  CommandPaletteListSection,
  CommandPaletteOption,
  CommandPaletteOptions,
  NoMatchingResults,
} from '../../../components/dialogs/command-palette';

export type BranchingCommandPaletteProps = {
  open?: boolean;
  onClose: () => void;
  currentBranch: Branch;
  branches: Branch[];
};

const experimentationActions = [
  {
    name: 'Merge Branch',
    onActionSelection: () => {},
  },
  {
    name: 'Create New Branch',
    onActionSelection: () => {},
  },
];

export const BranchingCommandPalette = ({
  open,
  onClose,
  currentBranch,
  branches,
}: BranchingCommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [branchActionOptions, setBranchActionOptions] = useState<
    ActionOption[]
  >([]);

  useEffect(() => {
    const allBranchActionOptions = branches.map((branch) => ({
      name: branch,
      onActionSelection: () => {},
    }));

    const filteredBranchActionOptions =
      query === ''
        ? allBranchActionOptions
        : allBranchActionOptions.filter((action) => {
            return action.name.toLowerCase().includes(query.toLowerCase());
          });
    setBranchActionOptions(filteredBranchActionOptions);
  }, [branches, currentBranch, query]);

  const filteredExperimentationActions =
    query === ''
      ? experimentationActions || []
      : (experimentationActions || []).filter((action) => {
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
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <DialogPanel
          transition
          className="mx-auto max-w-2xl transform divide-y divide-gray-500/10 overflow-hidden bg-white/80 shadow-2xl ring-1 ring-black/5 backdrop-blur backdrop-filter transition-all data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-zinc-900/80"
        >
          <Combobox
            onChange={(option: ActionOption | null) => {
              if (option === null) return;
              onClose();
              setQuery('');

              // as the Command Palette dialog has a smooth transition out effect (see data-[leave]:duration-200 above)
              // we trigger the action selection after a short delay
              // so actions that came after the dialog closing can be executed timely.
              // specifically, this is useful for other dialogs (like the CommitDialog) to persist their input focus.
              setTimeout(() => option.onActionSelection(), 250);
            }}
          >
            <div className="grid grid-cols-1">
              <CommandPaletteInput
                placeholder="Search for branches and actions"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onBlur={() => {
                  setQuery('');
                }}
              />
            </div>

            <CommandPaletteOptions>
              {filteredExperimentationActions.length > 0 && (
                <CommandPaletteListSection title="Experimentation">
                  {filteredExperimentationActions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={action.name}
                      value={action}
                    />
                  ))}
                </CommandPaletteListSection>
              )}

              {branchActionOptions.length > 0 && (
                <CommandPaletteListSection title="Branches">
                  {branchActionOptions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={action.name}
                      value={action}
                    />
                  ))}
                </CommandPaletteListSection>
              )}
            </CommandPaletteOptions>
            {query !== '' &&
              [...filteredExperimentationActions, ...branchActionOptions]
                .length === 0 && <NoMatchingResults />}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
