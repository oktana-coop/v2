import {
  type MetadataEntry,
  type prosemirror,
} from '../../../../../../modules/domain/rich-text';
import { Checkbox } from '../../../inputs/Checkbox';
import { Field } from '../../../inputs/Fieldset';
import { MetadataGrid, MetadataGridRow } from '../MetadataGrid';
import { MetadataValueView } from '../MetadataValueView';
import { textListItems } from '../text-list';
import { BlocksField } from './BlocksField';
import {
  type EditMetadataFn,
  type FieldProps,
  type MetadataEditFailure,
} from './field-props';
import { TextFieldErrors } from './FieldErrors';
import { InlinesField } from './InlinesField';
import { KeyField } from './KeyField';
import { RowMenu } from './RowMenu';
import { TextListField } from './TextListField';
import { useTextDraft } from './use-text-draft';
import { validateKey } from './validation';

type FormProps = {
  failures: prosemirror.MetadataEditFailures;
  onEdit: EditMetadataFn;
  onClearFailure: (key: string) => void;
};

// An entry's value field; a value the form doesn't edit shows as it is.
const ValueField = ({
  entry: { key, value },
  ...fieldProps
}: FieldProps & { entry: MetadataEntry }) => {
  switch (value.type) {
    case 'MetaBool':
      return (
        <Checkbox
          checked={value.value}
          color="zinc"
          aria-label={key}
          onChange={(checked) =>
            fieldProps.onEdit({ type: 'setBoolean', key, value: checked })
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

const isKeyEdit = (failure: MetadataEditFailure): boolean =>
  failure.edit.type === 'renameKey' || failure.edit.type === 'removeKey';

const EntryRow = ({
  entry,
  otherKeys,
  failures,
  onEdit,
  onClearFailure,
}: FormProps & { entry: MetadataEntry; otherKeys: string[] }) => {
  const { key } = entry;
  const failure = failures.get(key);
  const keyFailure = failure && isKeyEdit(failure) ? failure : undefined;
  const valueFailure = failure && !isKeyEdit(failure) ? failure : undefined;

  const handleClearFailure = () => {
    onClearFailure(key);
  };

  const keyDraft = useTextDraft({
    source: key,
    failedText: failure?.edit.type === 'renameKey' ? failure.edit.newKey : null,
    validate: validateKey(otherKeys),
    onFocus: handleClearFailure,
    onCommit: ({ text }) => onEdit({ type: 'renameKey', key, newKey: text }),
  });

  return (
    <Field className="group/row contents">
      <MetadataGridRow
        term={
          <KeyField
            metadataKey={key}
            draft={keyDraft}
            invalid={
              keyDraft.validationError !== null || keyFailure !== undefined
            }
          />
        }
      >
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <ValueField
              entry={entry}
              metadataKey={key}
              failure={valueFailure}
              onEdit={onEdit}
              onClearFailure={handleClearFailure}
            />
          </div>
          <RowMenu metadataKey={key} onEdit={onEdit} />
        </div>
        <TextFieldErrors
          validationError={keyDraft.validationError}
          failure={keyFailure}
        />
      </MetadataGridRow>
    </Field>
  );
};

export const MetadataForm = ({
  entries,
  ...formProps
}: FormProps & { entries: MetadataEntry[] }) => {
  const keys = entries.map(({ key }) => key);

  return (
    <MetadataGrid>
      {entries.map((entry) => (
        <EntryRow
          key={entry.key}
          entry={entry}
          otherKeys={keys.filter((key) => key !== entry.key)}
          {...formProps}
        />
      ))}
    </MetadataGrid>
  );
};
