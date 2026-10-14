import { type Participant } from '../../../../../modules/domain/collaboration';
import { PresenceAvatars } from '../../../components/user/PresenceAvatars';
import { ActionsBarTitle } from '../actions-bar-title';
import { SidebarToggleButton } from '../sidebar-toggle-button';
import { type CommitAction, CommitButton } from './CommitButton';
import { ShareButton } from './ShareButton';

export const PlainTextActionsBar = ({
  title,
  isShared,
  participants,
  onShareClick,
  commitAction,
}: {
  title: string;
  isShared: boolean;
  participants: Participant[];
  onShareClick: () => void;
  commitAction: CommitAction | null;
}) => (
  <div className="flex flex-initial items-center justify-between px-4 py-2">
    <SidebarToggleButton />
    <ActionsBarTitle title={title} />
    <div className="flex flex-initial items-center gap-2">
      <PresenceAvatars participants={participants} />
      <ShareButton isShared={isShared} onShareClick={onShareClick} />
      {commitAction && <CommitButton commitAction={commitAction} />}
    </div>
  </div>
);
