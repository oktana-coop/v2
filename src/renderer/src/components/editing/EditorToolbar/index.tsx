import { IconButton } from '../../../components/actions/IconButton';
import {
  FormatBoldIcon,
  FormatHeading1Icon,
  FormatHeading2Icon,
  FormatHeading3Icon,
  FormatHeading4Icon,
  FormatItalicIcon,
  FormatTextIcon,
  ImageIcon,
  LinkIcon,
} from '../../../components/icons';
import { blockElementTypes } from '../../../richText';
import { BlockElementType } from '../../../richText';
import { BlockSelect } from './BlockSelect';

const blockOptions = [
  {
    label: 'Paragraph',
    value: blockElementTypes.PARAGRAPH,
    icon: FormatTextIcon,
  },
  {
    label: 'Heading 1',
    value: blockElementTypes.HEADING_1,
    icon: FormatHeading1Icon,
  },
  {
    label: 'Heading 2',
    value: blockElementTypes.HEADING_2,
    icon: FormatHeading2Icon,
  },
  {
    label: 'Heading 3',
    value: blockElementTypes.HEADING_3,
    icon: FormatHeading3Icon,
  },
  {
    label: 'Heading 4',
    value: blockElementTypes.HEADING_4,
    icon: FormatHeading4Icon,
  },
];

export const EditorToolbar = ({
  blockType,
  onBlockSelect,
  strongSelected,
  emSelected,
  onStrongToggle,
  onEmToggle,
}: {
  blockType: BlockElementType;
  onBlockSelect: (type: BlockElementType) => void;
  strongSelected: boolean;
  emSelected: boolean;
  onStrongToggle: () => void;
  onEmToggle: () => void;
}) => {
  return (
    <div className="flex gap-x-6 bg-neutral-200 px-4 py-1.5 dark:bg-neutral-700">
      <div className="flex flex-initial gap-x-1">
        <BlockSelect
          value={blockType}
          options={blockOptions}
          onSelect={onBlockSelect}
        />
      </div>
      <div className="flex flex-initial gap-x-1">
        <IconButton
          icon={<FormatBoldIcon />}
          color={strongSelected ? 'purple' : undefined}
          onClick={onStrongToggle}
        />
        <IconButton
          icon={<FormatItalicIcon />}
          color={emSelected ? 'purple' : undefined}
          onClick={onEmToggle}
        />
        <IconButton icon={<LinkIcon />} />
      </div>
      <div className="flex flex-initial gap-x-1">
        <IconButton icon={<ImageIcon />} />
      </div>
    </div>
  );
};
