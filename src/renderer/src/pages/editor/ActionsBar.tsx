import { IconButton } from '../../components/actions/IconButton';
import {
  CheckIcon,
  SidebarOpenIcon,
  ToolbarToggleIcon,
} from '../../components/icons';

export const ActionsBar = ({
  onEditorToolbarToggle,
  onCheckIconClick,
}: {
  onEditorToolbarToggle: () => void;
  onCheckIconClick: () => void;
}) => {
  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle();
  };

  const handleCheckIconClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onCheckIconClick();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton icon={<SidebarOpenIcon />} />
      <div className="flex flex-initial items-center gap-2">
        <IconButton
          icon={<ToolbarToggleIcon />}
          onClick={handleToolbarToggle}
        />
        <IconButton
          onClick={handleCheckIconClick}
          icon={<CheckIcon />}
          color="purple"
        />
      </div>
    </div>
  );
};
