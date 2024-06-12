import { IconButton } from '../../components/actions/IconButton';
import {
  FormatBoldIcon,
  FormatHeadingDropdownIcon,
  FormatItalicIcon,
  FormatListDropdownIcon,
  ImageIcon,
  LinkIcon,
} from '../../components/icons';

export const EditorToolbar = () => {
  return (
    <div className="flex bg-neutral-200 dark:bg-neutral-700 px-4 py-1.5 gap-x-6">
      <div className="flex-initial flex gap-x-1">
        <IconButton icon={<FormatHeadingDropdownIcon />} />
        <IconButton icon={<FormatListDropdownIcon />} />
      </div>
      <div className="flex-initial flex gap-x-1">
        <IconButton icon={<FormatBoldIcon />} />
        <IconButton icon={<FormatItalicIcon />} />
        <IconButton icon={<LinkIcon />} />
      </div>
      <div className="flex-initial flex gap-x-1">
        <IconButton icon={<ImageIcon />} />
      </div>
    </div>
  );
};
