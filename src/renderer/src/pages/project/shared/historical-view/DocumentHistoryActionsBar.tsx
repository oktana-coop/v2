import { useRef } from 'react';

import {
  type CommitId,
  type CommitWithUrlInfo,
  decodeUrlEncodedCommitId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { IconButton } from '../../../../components/actions/IconButton';
import { SidebarIcon, SidebarOpenIcon } from '../../../../components/icons';
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

export const DocumentHistoryActionsBar = ({
  title,
  titleComponent,
  isSidebarOpen,
  onSidebarToggle,
  canShowDiff,
  showDiff,
  onSetShowDiffChecked,
  diffCommitId,
  history,
  onDiffCommitSelect,
  actions,
}: {
  title: string;
  titleComponent?: React.ReactNode;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  canShowDiff: boolean;
  showDiff: boolean;
  onSetShowDiffChecked: (value: boolean) => void;
  diffCommitId: CommitId | null;
  history: Array<CommitWithUrlInfo>;
  onDiffCommitSelect: (commitId: CommitId) => void;
  actions?: React.ReactNode;
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
      <div className="flex max-h-14 flex-auto items-center overflow-y-hidden px-4">
        {titleComponent ?? <h3 className="text-left text-base/7">{title}</h3>}
      </div>
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

            <div className="max-w-64">
              <Listbox
                name="diff commits"
                value={diffCommitId ? urlEncodeChangeId(diffCommitId) : null}
                onChange={handleDiffCommitSelect}
                disabled={!showDiff}
              >
                {history.map(({ message, urlEncodedChangeId }) => (
                  <ListboxOption
                    key={urlEncodedChangeId}
                    value={urlEncodedChangeId}
                    className="max-w-2xl"
                  >
                    <ListboxLabel>{message}</ListboxLabel>
                  </ListboxOption>
                ))}
              </Listbox>
            </div>
          </div>
        )}

        {actions}
      </div>
    </div>
  );
};
