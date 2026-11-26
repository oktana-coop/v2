import { IconButton } from '../../actions/IconButton';
import { FormatCodeIcon, ViewListIcon } from '../../icons';

export const MetadataPanelModeToggle = ({
  isEditable,
  showYaml,
  onShowYamlChange,
}: {
  isEditable: boolean;
  showYaml: boolean;
  onShowYamlChange: (showYaml: boolean) => void;
}) => {
  const action = isEditable ? 'Edit' : 'Show';

  return showYaml ? (
    <IconButton
      icon={<ViewListIcon />}
      tooltip={`${action} as form`}
      onClick={() => onShowYamlChange(false)}
    />
  ) : (
    <IconButton
      icon={<FormatCodeIcon />}
      tooltip={`${action} as YAML`}
      onClick={() => onShowYamlChange(true)}
    />
  );
};
