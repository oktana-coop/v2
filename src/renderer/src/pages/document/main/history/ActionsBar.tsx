import { useRef } from 'react';

import {
  type ChangeWithUrlInfo,
  type CommitId,
  decodeUrlEncodedCommitId,
  isCommitWithUrlInfo,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { IconButton } from '../../../../components/actions/IconButton';
import {
  CheckIcon,
  PenIcon,
  RevertIcon,
  SidebarIcon,
  SidebarOpenIcon,
} from '../../../../components/icons';
import {
  Checkbox,
  CheckboxField,
} from '../../../../components/inputs/Checkbox';
import { Label } from '../../../../components/inputs/Fieldset';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../../components/inputs/Listbox';

export const ActionsBar = ({
  title,
  isSidebarOpen,
  onSidebarToggle,
  onRevertIconClick,
  canShowDiff,
  showDiff,
  onSetShowDiffChecked,
  diffWith,
  history,
  onDiffCommitSelect,
  lastChangeIsCommitAndSelected,
  uncommittedChangesSelected,
  onEditIconClick,
  onCommitIconClick,
}: {
  title: string;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onRevertIconClick: () => void;
  canShowDiff: boolean;
  showDiff: boolean;
  onSetShowDiffChecked: (value: boolean) => void;
  diffWith: CommitId | null;
  history: Array<ChangeWithUrlInfo>;
  onDiffCommitSelect: (commitId: CommitId) => void;
  canCommit: boolean;
  lastChangeIsCommitAndSelected: boolean;
  uncommittedChangesSelected: boolean;
  onEditIconClick: () => void;
  onCommitIconClick: () => void;
}) => {
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSidebarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onSidebarToggle();

    // manually remove the hover state because headless-ui doesn't handle it properly in this case
    if (sidebarButtonRef.current) {
      sidebarButtonRef.current.removeAttribute('data-headlessui-state');
      sidebarButtonRef.current.removeAttribute('data-hover');
    }
  };

  const handleRevertIconClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onRevertIconClick();
  };

  const handleCheckIconClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onCommitIconClick();
  };

  const handleDiffCommitSelect = (commitId: string) => {
    const decodedChangeId = decodeUrlEncodedCommitId(commitId);
    if (decodedChangeId) {
      onDiffCommitSelect(decodedChangeId);
    }
  };

  return (
    <div className="flex min-h-[52px] flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
      <h3 className="flex-auto px-4 text-left text-base/7">{title}</h3>
      <div className="flex flex-initial items-center gap-3">
        {canShowDiff && (
          <div className="flex items-center gap-2">
            <CheckboxField className="flex items-center !gap-x-2">
              <Checkbox
                disabled={!canShowDiff}
                checked={showDiff}
                onChange={onSetShowDiffChecked}
                color="purple"
              />
              <Label className="whitespace-nowrap">Show Diff with</Label>
            </CheckboxField>

            <Listbox
              name="diff commits"
              value={diffWith ? urlEncodeChangeId(diffWith) : null}
              onChange={handleDiffCommitSelect}
              disabled={!showDiff}
            >
              {history
                .filter(isCommitWithUrlInfo)
                .map(({ message, urlEncodedChangeId }) => (
                  <ListboxOption
                    key={urlEncodedChangeId}
                    value={urlEncodedChangeId}
                  >
                    <ListboxLabel>{message}</ListboxLabel>
                  </ListboxOption>
                ))}
            </Listbox>
          </div>
        )}

        <IconButton
          onClick={
            uncommittedChangesSelected
              ? handleCheckIconClick
              : handleRevertIconClick
          }
          icon={uncommittedChangesSelected ? <CheckIcon /> : <RevertIcon />}
          disabled={lastChangeIsCommitAndSelected}
          color={uncommittedChangesSelected ? 'purple' : undefined}
          tooltip={
            uncommittedChangesSelected
              ? 'Commit Changes'
              : 'Revert to this State'
          }
        />

        <IconButton
          icon={<PenIcon />}
          onClick={onEditIconClick}
          tooltip="Edit Document"
        />
      </div>
    </div>
  );
};
