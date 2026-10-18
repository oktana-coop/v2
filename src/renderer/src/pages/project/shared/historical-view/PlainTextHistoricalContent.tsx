import { inferPlainTextLanguageFromExtension } from '../../../../../../modules/domain/plain-text';
import { type ProjectRelPath } from '../../../../../../modules/domain/project';
import {
  type ArtifactId,
  type ChangeId,
  type CommitId,
} from '../../../../../../modules/infrastructure/version-control';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import { ContentLoadError } from './ContentLoadError';
import { ReadOnlyPlainTextDocumentView } from './ReadOnlyPlainTextDocumentView';
import { useHistoricalPlainTextDocument } from './use-historical-plain-text-document';

export const PlainTextHistoricalContent = ({
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
  const { text, diffBase, loading, error } = useHistoricalPlainTextDocument({
    documentId,
    changeId,
    diffCommitId,
  });

  if (loading) {
    return <LongTextSkeleton />;
  }

  if (error) {
    return <ContentLoadError message={error} />;
  }

  if (!text) {
    return null;
  }

  return (
    <ReadOnlyPlainTextDocumentView
      text={text}
      language={inferPlainTextLanguageFromExtension(documentPath)}
      diffBase={diffBase}
    />
  );
};
