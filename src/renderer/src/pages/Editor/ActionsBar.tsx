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
  return (
    <div className="flex-initial px-4 py-2 flex items-center justify-between">
      <IconButton icon={<SidebarOpenIcon />} />
      <div className="flex-initial flex items-center gap-2">
        <IconButton
          icon={<ToolbarToggleIcon />}
          onClick={onEditorToolbarToggle}
        />
        <IconButton icon={<CheckIcon />} color="purple" />
      </div>
    </div>
  );
};
