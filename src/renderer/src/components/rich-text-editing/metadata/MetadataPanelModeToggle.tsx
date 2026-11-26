import { IconButton } from '../../actions/IconButton';
import { FormatCodeIcon, ViewListIcon } from '../../icons';

export const MetadataPanelModeToggle = ({
  showYaml,
  onShowYamlChange,
}: {
  showYaml: boolean;
  onShowYamlChange: (showYaml: boolean) => void;
}) =>
  showYaml ? (
    <IconButton
      icon={<ViewListIcon />}
      tooltip="Edit as form"
      onClick={() => onShowYamlChange(false)}
    />
  ) : (
    <IconButton
      icon={<FormatCodeIcon />}
      tooltip="Edit as YAML"
      onClick={() => onShowYamlChange(true)}
    />
  );
