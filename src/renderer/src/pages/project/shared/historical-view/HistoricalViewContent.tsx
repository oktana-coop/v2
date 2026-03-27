import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import {
  type DiffViewProps,
  ReadOnlyDocumentView,
} from './ReadOnlyDocumentView';

export const HistoricalViewContent = ({
  doc,
  diffProps,
  loading,
  error,
}: {
  doc: VersionedDocument | null;
  diffProps: DiffViewProps | null;
  loading: boolean;
  error: string | null;
}) => {
  if (loading) {
    return <LongTextSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-400 dark:text-neutral-500">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return null;
  }

  if (diffProps) {
    return <ReadOnlyDocumentView {...diffProps} />;
  }

  return <ReadOnlyDocumentView doc={doc} />;
};
