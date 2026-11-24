import {
  type MetadataEdit,
  type MetadataEntry,
} from '../../../../../modules/domain/rich-text';
import { Checkbox } from '../../inputs/Checkbox';
import { MetadataGrid, MetadataGridRow } from './MetadataGrid';
import { MetadataValueView } from './MetadataValueView';

type EditMetadataFn = (edit: MetadataEdit) => void;

// An entry's field; a value the form doesn't edit shows as it is.
const EntryField = ({
  entry: { key, value },
  onEdit,
}: {
  entry: MetadataEntry;
  onEdit: EditMetadataFn;
}) => {
  switch (value.type) {
    case 'MetaBool':
      return (
        <Checkbox
          checked={value.value}
          color="zinc"
          aria-label={key}
          onChange={(checked) =>
            onEdit({ type: 'setBoolean', key, value: checked })
          }
        />
      );
    case 'MetaInlines':
    case 'MetaBlocks':
    case 'MetaList':
    case 'MetaMap':
      return <MetadataValueView label={key} value={value} />;
  }
};

export const MetadataForm = ({
  entries,
  onEdit,
}: {
  entries: MetadataEntry[];
  onEdit: EditMetadataFn;
}) => (
  <MetadataGrid>
    {entries.map((entry) => (
      <MetadataGridRow key={entry.key} term={entry.key}>
        <EntryField entry={entry} onEdit={onEdit} />
      </MetadataGridRow>
    ))}
  </MetadataGrid>
);
