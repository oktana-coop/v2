import {
  type MetadataValue,
  textListItems,
} from '../../../../../modules/domain/rich-text';
import { Badge } from '../../highlighting/Badge';
import { Checkbox } from '../../inputs/Checkbox';

const itemCount = (count: number): string =>
  count === 1 ? '1 item' : `${count} items`;

const ListValue = ({ items }: { items: MetadataValue[] }) => {
  const textItems = textListItems(items);

  if (textItems === null) {
    return <span>{itemCount(items.length)}</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {textItems.map((item, index) => (
        <Badge key={index} color="zinc">
          {item}
        </Badge>
      ))}
    </span>
  );
};

export const MetadataValueView = ({
  label,
  value,
}: {
  label: string;
  value: MetadataValue;
}) => {
  switch (value.type) {
    case 'MetaInlines':
      return <span>{value.source}</span>;
    case 'MetaBlocks':
      return (
        <span className="whitespace-pre-wrap">{value.source.trimEnd()}</span>
      );
    case 'MetaBool':
      return (
        <Checkbox
          checked={value.value}
          color="zinc"
          aria-label={label}
          aria-readonly
          className="pointer-events-none"
        />
      );
    case 'MetaList':
      return <ListValue items={value.items} />;
    case 'MetaMap':
      return <span>{value.entries.map((entry) => entry.key).join(', ')}</span>;
  }
};
