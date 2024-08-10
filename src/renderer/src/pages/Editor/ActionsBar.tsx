import { IconButton } from '../../components/actions/IconButton';
import {
  CheckIcon,
  SidebarOpenIcon,
  ToolbarToggleIcon,
} from '../../components/icons';

export const ActionsBar = ({
  onEditorToolbarToggle,
}: {
  onEditorToolbarToggle: () => void;
}) => {
  const handleToolbarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onEditorToolbarToggle();
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton icon={<SidebarOpenIcon />} />
      <div className="flex flex-initial items-center gap-2">
        <IconButton
          icon={<ToolbarToggleIcon />}
          onClick={handleToolbarToggle}
        />
        <IconButton icon={<CheckIcon />} color="purple" />
      </div>
    </div>
  );
};
