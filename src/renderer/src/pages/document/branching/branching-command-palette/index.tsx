import { Combobox, Dialog, DialogPanel } from '@headlessui/react';
import { useEffect, useState } from 'react';

import {
  type Branch,
  DEFAULT_BRANCH,
} from '../../../../../../modules/infrastructure/version-control';
import {
  type ActionOption,
  CommandPaletteInput,
  CommandPaletteListSection,
  CommandPaletteOption,
  CommandPaletteOptions,
  NoMatchingResults,
} from '../../../../components/dialogs/command-palette';
import { Badge } from '../../../../components/highlighting/Badge';
import {
  BranchIcon,
  MergeIcon,
  PenIcon,
  PlusIcon,
} from '../../../../components/icons';
import { useBranchInfo } from '../../../../hooks';

export type BranchingCommandPaletteProps = {
  open?: boolean;
  onClose: () => void;
  currentBranch: Branch;
};

export const BranchingCommandPalette = ({
  open,
  onClose,
  currentBranch,
}: BranchingCommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [branchActionOptions, setBranchActionOptions] = useState<
    ActionOption[]
  >([]);
  const [experimentationActionOptions, setExperimentationActionOptions] =
    useState<ActionOption[]>([]);
  const { listBranches, switchToBranch, openCreateBranchDialog } =
    useBranchInfo();

  useEffect(() => {
    if (branches) {
      const allBranchActionOptions = branches.map((branch) => ({
        name: branch,
        onActionSelection: () => switchToBranch(branch),
        icon: branch === currentBranch ? PenIcon : BranchIcon,
      }));

      const filteredBranchActionOptions =
        query === ''
          ? allBranchActionOptions
          : allBranchActionOptions.filter((action) => {
              return action.name.toLowerCase().includes(query.toLowerCase());
            });
      setBranchActionOptions(filteredBranchActionOptions);
    }
  }, [branches, currentBranch, query]);

  useEffect(() => {
    const getBranches = async () => {
      const listedBranches = await listBranches();
      setBranches(listedBranches);
    };

    if (open) {
      getBranches();
    }
  }, [open, listBranches]);

  useEffect(() => {
    if (branches) {
      const mergeAction = {
        name: 'Merge to Main Branch',
        onActionSelection: () => {},
        icon: MergeIcon,
      };

      const createBranchAction = {
        name: 'Create New Branch',
        onActionSelection: () => openCreateBranchDialog(),
        icon: PlusIcon,
      };

      const expActions =
        currentBranch === DEFAULT_BRANCH
          ? [createBranchAction]
          : [mergeAction, createBranchAction];

      const filteredExperimentationActionOptions =
        query === ''
          ? expActions
          : expActions.filter((action) => {
              return action.name.toLowerCase().includes(query.toLowerCase());
            });
      setExperimentationActionOptions(filteredExperimentationActionOptions);
    }
  }, [branches, currentBranch, query]);

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
              {experimentationActionOptions.length > 0 && (
                <CommandPaletteListSection title="Experimentation">
                  {experimentationActionOptions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={action.name}
                      value={action}
                      icon={action.icon}
                    />
                  ))}
                </CommandPaletteListSection>
              )}

              {branchActionOptions.length > 0 && (
                <CommandPaletteListSection title="Branches">
                  {branchActionOptions.map((action) => (
                    <CommandPaletteOption
                      key={action.name}
                      label={
                        action.name === currentBranch ? (
                          <span className="flex-auto truncate">
                            {action.name}
                            <Badge className="ml-2">current</Badge>
                          </span>
                        ) : (
                          action.name
                        )
                      }
                      value={action}
                      icon={action.icon}
                    />
                  ))}
                </CommandPaletteListSection>
              )}
            </CommandPaletteOptions>
            {query !== '' &&
              [...experimentationActionOptions, ...branchActionOptions]
                .length === 0 && <NoMatchingResults />}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
