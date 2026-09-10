import { getInitials } from '../../../../modules/auth';
import { type Participant } from '../../../../modules/domain/rich-text';
import { Tooltip } from '../accessibility/Tooltip';
import { Avatar } from './Avatar';
import { getColorClass } from './color';

const MAX_SHOWN = 4;

export const PresenceAvatars = ({
  participants,
}: {
  participants: Participant[];
}) => {
  if (participants.length === 0) return null;

  const shown = participants.slice(0, MAX_SHOWN);
  const rest = participants.slice(MAX_SHOWN);

  return (
    <div
      className="flex items-center -space-x-2"
      data-testid="presence-avatars"
    >
      {shown.map(({ name, email, avatarUrl }) => (
        <Tooltip key={`${name}:${email ?? ''}`} text={name}>
          <Avatar
            src={avatarUrl}
            initials={avatarUrl ? undefined : getInitials(name)}
            alt={name}
            className={`size-8 ${avatarUrl ? '' : getColorClass(name)}`}
            data-testid="presence-avatar"
          />
        </Tooltip>
      ))}
      {rest.length > 0 && (
        <Tooltip text={rest.map(({ name }) => name).join(', ')}>
          <span
            className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-gray-200 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            data-testid="presence-avatar-overflow"
          >
            +{rest.length}
          </span>
        </Tooltip>
      )}
    </div>
  );
};
