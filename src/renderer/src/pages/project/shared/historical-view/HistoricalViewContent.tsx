import { useContext } from 'react';

import { type ProjectRelPath } from '../../../../../../modules/domain/project';
import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import { EditorMetadataPanel } from '../../../../components/rich-text-editing/metadata/MetadataPanel';
import { ContentLoadError } from './ContentLoadError';
import {
  type DiffViewProps,
  ReadOnlyRichTextDocumentView,
} from './ReadOnlyRichTextDocumentView';

export const HistoricalViewContent = ({
  doc,
  diffProps,
  documentPath,
  loading,
  error,
}: {
  doc: VersionedDocument | null;
  diffProps: DiffViewProps | null;
  documentPath: ProjectRelPath | null;
  loading: boolean;
  error: string | null;
}) => {
  const { showMetadata } = useContext(FunctionalityConfigContext);

  if (loading) {
    return <LongTextSkeleton />;
  }

  if (error) {
    return <ContentLoadError message={error} />;
  }

  if (!doc || !documentPath) {
    return null;
  }

  return (
    <>
      {showMetadata && <EditorMetadataPanel />}
      {diffProps ? (
        <ReadOnlyRichTextDocumentView {...diffProps} />
      ) : (
        <ReadOnlyRichTextDocumentView doc={doc} documentPath={documentPath} />
      )}
    </>
  );
};
