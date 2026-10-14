import {
  type ArtifactKind,
  artifactKinds,
  isDocumentKind,
  type ProjectRelPath,
} from '../../../../../../modules/domain/project';
import {
  type ArtifactId,
  type ChangeId,
  type CommitId,
  type CommitWithUrlInfo,
} from '../../../../../../modules/infrastructure/version-control';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import { UnsupportedDocumentView } from '../../shared/unsupported-document-view';
import { DocumentHistoryActionsBar } from './DocumentHistoryActionsBar';
import { PlainTextHistoricalContent } from './PlainTextHistoricalContent';
import { RichTextHistoricalContent } from './RichTextHistoricalContent';

export type HistoricalDocumentViewProps = {
  documentId: ArtifactId | null;
  documentPath: ProjectRelPath | null;
  kind: ArtifactKind | null;
  resolvingArtifact: boolean;
  changeId: ChangeId | null;
  showDiff: boolean;
  onSetShowDiff: (value: boolean) => void;
  diffCommitId: CommitId | null;
  onDiffCommitSelect: (id: CommitId) => void;
  canShowDiff: boolean;
  diffSelectorCommits: CommitWithUrlInfo[];
  title: string;
  titleComponent?: React.ReactNode;
  actions?: React.ReactNode;
};

const HistoricalContent = ({
  documentId,
  documentPath,
  kind,
  resolvingArtifact,
  changeId,
  diffCommitId,
}: Pick<
  HistoricalDocumentViewProps,
  | 'documentId'
  | 'documentPath'
  | 'kind'
  | 'resolvingArtifact'
  | 'changeId'
  | 'diffCommitId'
>) => {
  if (
    documentId &&
    documentPath &&
    kind === artifactKinds.PLAIN_TEXT_DOCUMENT
  ) {
    return (
      <PlainTextHistoricalContent
        documentId={documentId}
        documentPath={documentPath}
        changeId={changeId}
        diffCommitId={diffCommitId}
      />
    );
  }

  if (documentId && documentPath && kind === artifactKinds.RICH_TEXT_DOCUMENT) {
    return (
      <NarrowCenteredLayout>
        <RichTextHistoricalContent
          documentId={documentId}
          documentPath={documentPath}
          changeId={changeId}
          diffCommitId={diffCommitId}
        />
      </NarrowCenteredLayout>
    );
  }

  if (resolvingArtifact) {
    return (
      <NarrowCenteredLayout>
        <LongTextSkeleton />
      </NarrowCenteredLayout>
    );
  }

  return null;
};

const NarrowCenteredLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full flex-auto flex-col items-center overflow-auto">
    <div className="flex w-full max-w-3xl flex-col">{children}</div>
  </div>
);

export const HistoricalDocumentView = ({
  documentId,
  documentPath,
  kind,
  resolvingArtifact,
  changeId,
  showDiff,
  onSetShowDiff,
  diffCommitId,
  onDiffCommitSelect,
  canShowDiff,
  diffSelectorCommits,
  title,
  titleComponent,
  actions,
}: HistoricalDocumentViewProps) => {
  if (documentPath && kind && !isDocumentKind(kind)) {
    return <UnsupportedDocumentView path={documentPath} />;
  }

  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <DocumentHistoryActionsBar
          title={title}
          titleComponent={titleComponent}
          canShowDiff={canShowDiff}
          showDiff={showDiff}
          onSetShowDiffChecked={onSetShowDiff}
          diffCommitId={diffCommitId}
          history={diffSelectorCommits}
          onDiffCommitSelect={onDiffCommitSelect}
          actions={actions}
        />
      </div>

      <div className="flex min-h-0 w-full flex-auto flex-col">
        <HistoricalContent
          documentId={documentId}
          documentPath={documentPath}
          kind={kind}
          resolvingArtifact={resolvingArtifact}
          changeId={changeId}
          diffCommitId={diffCommitId}
        />
      </div>
    </div>
  );
};
