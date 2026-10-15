import { type Participant } from '../../../../../modules/domain/collaboration';
import { IconButton } from '../../../components/actions/IconButton';
import { ToolbarToggleIcon } from '../../../components/icons';
import { PresenceAvatars } from '../../../components/user/PresenceAvatars';
import { ActionsBarTitle } from '../actions-bar-title';
import { SidebarToggleButton } from '../sidebar-toggle-button';
import { type CommitAction, CommitButton } from './CommitButton';
import { ShareButton } from './ShareButton';

export { PlainTextActionsBar } from './PlainTextActionsBar';

export const ActionsBar = ({
  title,
  onEditorToolbarToggle,
  isShared,
  participants,
  onShareClick,
  commitAction,
}: {
  title: string;
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
      <ActionsBarTitle title={title} />
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
