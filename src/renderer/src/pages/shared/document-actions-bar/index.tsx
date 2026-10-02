import { type Participant } from '../../../../../modules/domain/rich-text';
import { IconButton } from '../../../components/actions/IconButton';
import {
  CheckIcon,
  GroupIcon,
  ToolbarToggleIcon,
  UserAddIcon,
} from '../../../components/icons';
import { PresenceAvatars } from '../../../components/user/PresenceAvatars';
import { SidebarToggleButton } from '../sidebar-toggle-button';

export const ActionsBar = ({
  onEditorToolbarToggle,
  isShared,
  participants,
  onShareClick,
  commitAction,
}: {
  onEditorToolbarToggle: () => void;
  isShared: boolean;
  participants: Participant[];
  onShareClick: () => void;
  commitAction: { canCommit: boolean; onCommitClick: () => void } | null;
}) => {
  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle();
  };

  const handleShareClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onShareClick();
  };

  const handleCommitClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    commitAction?.onCommitClick();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <SidebarToggleButton />
      <div className="flex flex-initial items-center gap-2">
        <PresenceAvatars participants={participants} />
        <IconButton
          icon={<ToolbarToggleIcon />}
          onClick={handleToolbarToggle}
          tooltip="Toggle Toolbar"
        />
        <IconButton
          icon={isShared ? <GroupIcon /> : <UserAddIcon />}
          onClick={handleShareClick}
          tooltip={isShared ? 'Sharing Options' : 'Share Document'}
        />
        {commitAction && (
          <IconButton
            onClick={handleCommitClick}
            icon={<CheckIcon />}
            color="purple"
            disabled={!commitAction.canCommit}
            tooltip="Commit Changes"
          />
        )}
      </div>
    </div>
  );
};
