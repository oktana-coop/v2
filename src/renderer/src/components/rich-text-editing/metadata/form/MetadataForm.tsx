import {
  type MetadataEntry,
  type prosemirror,
} from '../../../../../../modules/domain/rich-text';
import { Checkbox } from '../../../inputs/Checkbox';
import { MetadataGrid, MetadataGridRow } from '../MetadataGrid';
import { MetadataValueView } from '../MetadataValueView';
import { textListItems } from '../text-list';
import { BlocksField } from './BlocksField';
import { type EditMetadataFn, type FieldProps } from './field-props';
import { InlinesField } from './InlinesField';
import { TextListField } from './TextListField';

type FormProps = {
  failures: prosemirror.MetadataEditFailures;
  onEdit: EditMetadataFn;
  onClearFailure: (key: string) => void;
};

// An entry's field; a value the form doesn't edit shows as it is.
const EntryField = ({
  entry: { key, value },
  failures,
  onEdit,
  onClearFailure,
}: FormProps & { entry: MetadataEntry }) => {
  const fieldProps: FieldProps = {
    metadataKey: key,
    failure: failures.get(key),
    onEdit,
    onClearFailure: () => onClearFailure(key),
  };

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
      return <InlinesField {...fieldProps} source={value.source} />;
    case 'MetaBlocks':
      return <BlocksField {...fieldProps} source={value.source} />;
    case 'MetaList': {
      const textItems = textListItems(value.items);

      return textItems ? (
        <TextListField {...fieldProps} items={textItems} />
      ) : (
        <MetadataValueView label={key} value={value} />
      );
    }
    case 'MetaMap':
      return <MetadataValueView label={key} value={value} />;
  }
};

export const MetadataForm = ({
  entries,
  ...formProps
}: FormProps & { entries: MetadataEntry[] }) => (
  <MetadataGrid>
    {entries.map((entry) => (
      <MetadataGridRow key={entry.key} term={entry.key}>
        <EntryField entry={entry} {...formProps} />
      </MetadataGridRow>
    ))}
  </MetadataGrid>
);
