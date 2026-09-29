import { getInitials, type Username } from '../../../../modules/auth';
import { DEFAULT_AUTHOR_NAME } from '../../../../modules/infrastructure/version-control';
import { Tooltip } from '../accessibility/Tooltip';
import { Avatar } from './Avatar';
import { getColorClass } from './color';

export const UserAvatar = ({ username }: { username: Username }) => {
  if (username === DEFAULT_AUTHOR_NAME) {
    return null;
  }

  return (
    <Tooltip text={username}>
      <Avatar
        initials={getInitials(username)}
        className={`size-8 ${getColorClass(username)}`}
      />
    </Tooltip>
  );
};
