import { type Participant } from '../../../../../modules/domain/collaboration';
import { IconButton } from '../../../components/actions/IconButton';
import { ToolbarToggleIcon } from '../../../components/icons';
import { PresenceAvatars } from '../../../components/user/PresenceAvatars';
import { SidebarToggleButton } from '../sidebar-toggle-button';
import { type CommitAction, CommitButton } from './CommitButton';
import { ShareButton } from './ShareButton';

export { PlainTextActionsBar } from './PlainTextActionsBar';

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
  commitAction: CommitAction | null;
}) => {
  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle();
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
        <ShareButton isShared={isShared} onShareClick={onShareClick} />
        {commitAction && <CommitButton commitAction={commitAction} />}
      </div>
    </div>
  );
};
