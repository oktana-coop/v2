import { IconButton } from '../../../components/actions/IconButton';
import { GroupIcon, UserAddIcon } from '../../../components/icons';

export const ShareButton = ({
  isShared,
  onShareClick,
}: {
  isShared: boolean;
  onShareClick: () => void;
}) => {
  const handleShareClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onShareClick();
  };

  return (
    <IconButton
      icon={isShared ? <GroupIcon /> : <UserAddIcon />}
      onClick={handleShareClick}
      tooltip={isShared ? 'Sharing Options' : 'Share Document'}
    />
  );
};
