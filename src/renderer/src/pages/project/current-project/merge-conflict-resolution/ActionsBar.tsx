import { MergeConflictInfo } from '../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../components/actions/Button';
import { IconButton } from '../../../../components/actions/IconButton';
import { ToolbarToggleIcon } from '../../../../components/icons';
import {
  Checkbox,
  CheckboxField,
} from '../../../../components/inputs/Checkbox';
import { Label } from '../../../../components/inputs/Fieldset';
import { SidebarToggleButton } from '../../../shared/sidebar-toggle-button';
import { MergeInfo } from './merge-info';
import { MergePole } from './merge-info/MergePole';

export const MergeConflictResolutionActionsBar = ({
  mergeConflictInfo,
  onAbortMerge,
  hasResolveConflictButton,
  onResolveConflict,
  hasEditorToolbarToggle,
  onEditorToolbarToggle,
  hasShowDiffCheckbox,
  showDiff,
  onSetShowDiffChecked,
}: {
  mergeConflictInfo: MergeConflictInfo;
  onAbortMerge: () => void;
  hasResolveConflictButton: boolean;
  onResolveConflict?: () => void;
  hasEditorToolbarToggle: boolean;
  onEditorToolbarToggle?: () => void;
  hasShowDiffCheckbox: boolean;
  showDiff?: boolean;
  onSetShowDiffChecked?: (value: boolean) => void;
}) => {
  const handleAbortMerge = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onAbortMerge();
  };

  const handleResolveConflict = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onResolveConflict?.();
  };

  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle?.();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <SidebarToggleButton />
      <h2 className="max-h-14 flex-auto overflow-y-hidden px-4 text-left text-base/7">
        Resolving merge conflicts:{' '}
        <MergeInfo mergeConflictInfo={mergeConflictInfo} />
      </h2>
      <div className="flex flex-initial items-center gap-2">
        {hasShowDiffCheckbox && (
          <CheckboxField className="flex items-center !gap-x-2">
            <Checkbox
              checked={showDiff}
              onChange={onSetShowDiffChecked}
              color="purple"
            />
            <Label className="whitespace-nowrap">
              Show Diff
              {mergeConflictInfo.targetBranch && (
                <span>
                  {' '}
                  with{' '}
                  <MergePole
                    branch={mergeConflictInfo.targetBranch}
                    commitId={mergeConflictInfo.targetCommitId}
                  />
                </span>
              )}
            </Label>
          </CheckboxField>
        )}
        {hasEditorToolbarToggle && (
          <IconButton
            icon={<ToolbarToggleIcon />}
            onClick={handleToolbarToggle}
          />
        )}
        <Button
          color="purple"
          variant="outline"
          onClick={handleAbortMerge}
          size="sm"
        >
          Abort Merge
        </Button>
        {hasResolveConflictButton && (
          <Button color="purple" onClick={handleResolveConflict} size="sm">
            Resolve Conflict
          </Button>
        )}
      </div>
    </div>
  );
};
