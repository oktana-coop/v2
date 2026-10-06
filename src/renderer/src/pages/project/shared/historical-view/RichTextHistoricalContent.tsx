import { type ProjectRelPath } from '../../../../../../modules/domain/project';
import {
  type ArtifactId,
  type ChangeId,
  type CommitId,
} from '../../../../../../modules/infrastructure/version-control';
import { HistoricalViewContent } from './HistoricalViewContent';
import { useHistoricalRichTextDocument } from './use-historical-rich-text-document';

export const RichTextHistoricalContent = ({
  documentId,
  documentPath,
  changeId,
  diffCommitId,
}: {
  documentId: ArtifactId;
  documentPath: ProjectRelPath;
  changeId: ChangeId | null;
  diffCommitId: CommitId | null;
}) => {
  const { doc, diffProps, loading, error } = useHistoricalRichTextDocument({
    documentId,
    documentPath,
    changeId,
    diffCommitId,
  });

  return (
    <HistoricalViewContent
      doc={doc}
      diffProps={diffProps}
      documentPath={documentPath}
      loading={loading}
      error={error}
    />
  );
};
