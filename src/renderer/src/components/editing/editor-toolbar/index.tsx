import {
  type BlockType,
  blockTypes,
  type ContainerBlockType,
  type LeafBlockType,
} from '../../../../../modules/domain/rich-text';
import { IconButton } from '../../actions/IconButton';
import {
  BulletListIcon,
  FormatBoldIcon,
  FormatCodeIcon,
  FormatHeading1Icon,
  FormatHeading2Icon,
  FormatHeading3Icon,
  FormatHeading4Icon,
  FormatHeading5Icon,
  FormatHeading6Icon,
  FormatItalicIcon,
  FormatQuoteIcon,
  FormatTextIcon,
  ImageIcon,
  LinkIcon,
  OrderedListIcon,
} from '../../icons';
import { NoteIcon } from '../../icons/Note';
import { BlockSelect } from './BlockSelect';

const blockOptions = [
  {
    label: 'Paragraph',
    value: blockTypes.PARAGRAPH,
    icon: FormatTextIcon,
  },
  {
    label: 'Heading 1',
    value: blockTypes.HEADING_1,
    icon: FormatHeading1Icon,
  },
  {
    label: 'Heading 2',
    value: blockTypes.HEADING_2,
    icon: FormatHeading2Icon,
  },
  {
    label: 'Heading 3',
    value: blockTypes.HEADING_3,
    icon: FormatHeading3Icon,
  },
  {
    label: 'Heading 4',
    value: blockTypes.HEADING_4,
    icon: FormatHeading4Icon,
  },
  {
    label: 'Heading 5',
    value: blockTypes.HEADING_5,
    icon: FormatHeading5Icon,
  },
  {
    label: 'Heading 6',
    value: blockTypes.HEADING_6,
    icon: FormatHeading6Icon,
  },
  {
    label: 'Code Block',
    value: blockTypes.CODE_BLOCK,
    icon: FormatCodeIcon,
  },
];

export const EditorToolbar = ({
  leafBlockType,
  containerBlockType,
  onBlockSelect,
  strongSelected,
  emSelected,
  selectionIsLink,
  codeSelected,
  onStrongToggle,
  onEmToggle,
  onLinkToggle,
  onCodeToggle,
  onNoteClick,
}: {
  leafBlockType: LeafBlockType;
  containerBlockType: ContainerBlockType | null;
  onBlockSelect: (type: BlockType) => void;
  strongSelected: boolean;
  emSelected: boolean;
  selectionIsLink: boolean;
  codeSelected: boolean;
  onStrongToggle: () => void;
  onEmToggle: () => void;
  onLinkToggle: () => void;
  onCodeToggle: () => void;
  onNoteClick: () => void;
}) => {
  const handleContainerBlockSelect = (type: ContainerBlockType) => () => {
    onBlockSelect(type);
  };

  return (
    <div className="flex gap-x-6 bg-neutral-200 px-4 py-1.5 dark:bg-neutral-700">
      <div className="flex flex-initial gap-x-1">
        <BlockSelect
          value={leafBlockType}
          options={blockOptions}
          onSelect={onBlockSelect}
        />
      </div>
      <div className="flex flex-initial gap-x-1">
        <IconButton
          icon={<BulletListIcon />}
          color={
            containerBlockType === blockTypes.BULLET_LIST ? 'purple' : undefined
          }
          onClick={handleContainerBlockSelect(blockTypes.BULLET_LIST)}
          tooltip="Bullet List"
        />
        <IconButton
          icon={<OrderedListIcon />}
          color={
            containerBlockType === blockTypes.ORDERED_LIST
              ? 'purple'
              : undefined
          }
          onClick={handleContainerBlockSelect(blockTypes.ORDERED_LIST)}
          tooltip="Ordered List"
        />
        <IconButton
          icon={<FormatQuoteIcon />}
          color={
            containerBlockType === blockTypes.BLOCKQUOTE ? 'purple' : undefined
          }
          onClick={handleContainerBlockSelect(blockTypes.BLOCKQUOTE)}
          tooltip="Quote"
        />
      </div>
      <div className="flex flex-initial gap-x-1">
        <IconButton
          icon={<FormatBoldIcon />}
          color={strongSelected ? 'purple' : undefined}
          onClick={onStrongToggle}
          tooltip="Bold"
        />
        <IconButton
          icon={<FormatItalicIcon />}
          color={emSelected ? 'purple' : undefined}
          onClick={onEmToggle}
          tooltip="Italics"
        />
        <IconButton
          icon={<LinkIcon />}
          color={selectionIsLink ? 'purple' : undefined}
          onClick={onLinkToggle}
          tooltip="Link"
        />
        <IconButton
          icon={<FormatCodeIcon />}
          color={codeSelected ? 'purple' : undefined}
          onClick={onCodeToggle}
          tooltip="Inline Code"
        />
      </div>
      <div className="flex flex-initial gap-x-1">
        <IconButton icon={<ImageIcon />} tooltip="Image" />
        <IconButton
          icon={<NoteIcon />}
          onClick={onNoteClick}
          tooltip="Footnote"
        />
      </div>
    </div>
  );
};
