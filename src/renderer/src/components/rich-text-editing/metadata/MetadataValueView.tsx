import { type MetadataValue } from '../../../../../modules/domain/rich-text';
import { Badge } from '../../highlighting/Badge';
import { Checkbox } from '../../inputs/Checkbox';

type InlinesValue = { type: 'MetaInlines'; source: string };

const isInlines = (value: MetadataValue): value is InlinesValue =>
  value.type === 'MetaInlines';

const itemCount = (count: number): string =>
  count === 1 ? '1 item' : `${count} items`;

const ListValue = ({ items }: { items: MetadataValue[] }) => {
  if (!items.every(isInlines)) {
    return <span>{itemCount(items.length)}</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <Badge key={index} color="zinc">
          {item.source}
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
