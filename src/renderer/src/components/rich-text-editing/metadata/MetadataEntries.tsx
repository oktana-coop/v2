import { type MetadataEntry } from '../../../../../modules/domain/rich-text';
import { MetadataGrid, MetadataGridRow } from './MetadataGrid';
import { MetadataValueView } from './MetadataValueView';

export const MetadataEntries = ({ entries }: { entries: MetadataEntry[] }) => (
  <MetadataGrid>
    {entries.map(({ key, value }) => (
      <MetadataGridRow key={key} term={key}>
        <MetadataValueView label={key} value={value} />
      </MetadataGridRow>
    ))}
  </MetadataGrid>
);
