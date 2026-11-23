import { Deleted, Inserted } from './DiffMarks';
import { type MetadataDiffRow } from './metadata-diff-rows';
import { MetadataGrid, MetadataGridRow } from './MetadataGrid';
import { MetadataValueView } from './MetadataValueView';

const RowKey = ({ row }: { row: MetadataDiffRow }) => {
  switch (row.mark) {
    case 'added':
      return <Inserted className="truncate">{row.key}</Inserted>;
    case 'removed':
      return <Deleted className="truncate">{row.key}</Deleted>;
    case 'unchanged':
    case 'changed':
      return row.key;
  }
};

const RowValue = ({ row }: { row: MetadataDiffRow }) => {
  switch (row.mark) {
    case 'unchanged':
      return <MetadataValueView label={row.key} value={row.value} />;
    case 'added':
      return (
        <Inserted>
          <MetadataValueView label={row.key} value={row.value} />
        </Inserted>
      );
    case 'removed':
      return (
        <Deleted>
          <MetadataValueView label={row.key} value={row.value} />
        </Deleted>
      );
    case 'changed':
      return (
        <span className="flex flex-col items-start gap-1">
          <Deleted>
            <MetadataValueView label={row.key} value={row.before} />
          </Deleted>
          <Inserted>
            <MetadataValueView label={row.key} value={row.after} />
          </Inserted>
        </span>
      );
  }
};

export const MetadataDiffRows = ({ rows }: { rows: MetadataDiffRow[] }) => (
  <MetadataGrid>
    {rows.map((row) => (
      <MetadataGridRow key={row.key} term={<RowKey row={row} />}>
        <RowValue row={row} />
      </MetadataGridRow>
    ))}
  </MetadataGrid>
);
