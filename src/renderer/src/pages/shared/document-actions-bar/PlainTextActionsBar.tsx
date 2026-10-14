import { type Participant } from '../../../../../modules/domain/collaboration';
import { PresenceAvatars } from '../../../components/user/PresenceAvatars';
import { SidebarToggleButton } from '../sidebar-toggle-button';
import { type CommitAction, CommitButton } from './CommitButton';
import { ShareButton } from './ShareButton';

export const PlainTextActionsBar = ({
  isShared,
  participants,
  onShareClick,
  commitAction,
}: {
  isShared: boolean;
  participants: Participant[];
  onShareClick: () => void;
  commitAction: CommitAction | null;
}) => (
  <div className="flex flex-initial items-center justify-between px-4 py-2">
    <SidebarToggleButton />
    <div className="flex flex-initial items-center gap-2">
      <PresenceAvatars participants={participants} />
      <ShareButton isShared={isShared} onShareClick={onShareClick} />
      {commitAction && <CommitButton commitAction={commitAction} />}
    </div>
  </div>
);
