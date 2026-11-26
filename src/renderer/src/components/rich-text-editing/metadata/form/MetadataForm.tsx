import {
  type FocusEvent,
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import {
  type MetadataEntry,
  type prosemirror,
  textListItems,
} from '../../../../../../modules/domain/rich-text';
import { Checkbox } from '../../../inputs/Checkbox';
import { Field } from '../../../inputs/Fieldset';
import { useFormPanel } from '../form-panel';
import { MetadataGrid, MetadataGridRow } from '../MetadataGrid';
import { MetadataValueView } from '../MetadataValueView';
import { useTextDraft } from '../use-text-draft';
import { AddEntryButton } from './AddEntryButton';
import { BlocksField } from './BlocksField';
import {
  type EditMetadataFn,
  type FieldProps,
  type MetadataEditFailure,
} from './field-props';
import { TextFieldErrors } from './FieldErrors';
import { InlinesField } from './InlinesField';
import { KeyField } from './KeyField';
import { type NewEntry, NewEntryRow } from './NewEntryRow';
import { RowMenu } from './RowMenu';
import { TextListField } from './TextListField';
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

// An added key's failure is its new row's, also when another row has the key.
const isAddition = (failure: MetadataEditFailure): boolean =>
  failure.edit.type === 'addKey';

const EntryRow = ({
  entry,
  otherKeys,
  failures,
  onEdit,
  onClearFailure,
  onInsertBelow,
}: FormProps & {
  entry: MetadataEntry;
  otherKeys: string[];
  onInsertBelow: (key: string) => void;
}) => {
  const { key } = entry;
  const { focus: focusPanel } = useFormPanel();
  // Whether the focus is in the row, or in its open menu.
  const hasFocus = useRef(false);
  const storedFailure = failures.get(key);
  const failure =
    storedFailure && !isAddition(storedFailure) ? storedFailure : undefined;
  const keyFailure = failure && isKeyEdit(failure) ? failure : undefined;
  const valueFailure = failure && !isKeyEdit(failure) ? failure : undefined;

  const handleClearFailure = () => {
    onClearFailure(key);
  };

  const handleInsertBelow = () => {
    onInsertBelow(key);
  };

  const handleFocus = () => {
    hasFocus.current = true;
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    hasFocus.current = event.currentTarget.contains(event.relatedTarget);
  };

  // When the row unmounts with the focus in it, the focus moves to the panel
  // instead of being lost.
  useLayoutEffect(
    () => () => {
      if (hasFocus.current) {
        focusPanel();
      }
    },
    [focusPanel]
  );

  const keyDraft = useTextDraft({
    source: key,
    failedText: failure?.edit.type === 'renameKey' ? failure.edit.newKey : null,
    validate: validateKey(otherKeys),
    onFocus: handleClearFailure,
    onCommit: ({ text }) => onEdit({ type: 'renameKey', key, newKey: text }),
  });

  return (
    <Field
      className="group/row contents"
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
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
          <RowMenu
            metadataKey={key}
            value={entry.value}
            onEdit={onEdit}
            onInsertBelow={handleInsertBelow}
          />
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
  const [newEntry, setNewEntry] = useState<NewEntry | null>(null);
  const newEntryName = useRef<HTMLInputElement>(null);
  const keys = entries.map(({ key }) => key);

  // A committed new property is an entry once the document holds its key.
  if (newEntry?.committed && keys.includes(newEntry.key)) {
    setNewEntry(null);
  }

  const storedNewEntryFailure =
    newEntry?.committed === true
      ? formProps.failures.get(newEntry.key)
      : undefined;
  const newEntryFailure =
    storedNewEntryFailure && isAddition(storedNewEntryFailure)
      ? storedNewEntryFailure
      : undefined;
  // Below the key it goes below while there is one, else after the others.
  const newEntryAfter =
    newEntry && newEntry.after !== null && keys.includes(newEntry.after)
      ? newEntry.after
      : null;

  // Opens a new row, or moves the one being edited, keeping what's typed in it,
  // and focuses its name; the row is rendered first, so the name can be focused.
  const handleOpenNewEntry = (after: string | null) => {
    flushSync(() => {
      setNewEntry((current) =>
        current && !current.committed
          ? { ...current, after }
          : { after, key: '', value: '', committed: false }
      );
    });
    newEntryName.current?.focus();
  };

  const handleAddEntry = () => {
    handleOpenNewEntry(null);
  };

  const handleDiscardNewEntry = () => {
    setNewEntry(null);
  };

  const newEntryRow = newEntry && (
    <NewEntryRow
      nameInput={newEntryName}
      entry={newEntry}
      existingKeys={keys}
      failure={newEntryFailure}
      onChange={setNewEntry}
      onDiscard={handleDiscardNewEntry}
      onEdit={formProps.onEdit}
      onClearFailure={formProps.onClearFailure}
    />
  );

  return (
    <>
      {(entries.length > 0 || newEntry) && (
        <MetadataGrid>
          {entries.map((entry) => (
            <Fragment key={entry.key}>
              <EntryRow
                entry={entry}
                otherKeys={keys.filter((key) => key !== entry.key)}
                onInsertBelow={handleOpenNewEntry}
                {...formProps}
              />
              {newEntryAfter === entry.key && newEntryRow}
            </Fragment>
          ))}
          {newEntryAfter === null && newEntryRow}
        </MetadataGrid>
      )}
      <AddEntryButton className="mt-2" onClick={handleAddEntry} />
    </>
  );
};
