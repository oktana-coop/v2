import { useContext, useMemo } from 'react';

import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import {
  type ChangeWithUrlInfo,
  type CommitId,
} from '../../../../../../modules/infrastructure/version-control';
import { SidebarLayoutContext } from '../../../../app-state';
import { isUnsupportedExtension } from '../../../../hooks/use-current-document-extension';
import { UnsupportedDocumentView } from '../../shared/unsupported-document-view';
import { DocumentHistoryActionsBar } from './DocumentHistoryActionsBar';
import { HistoricalViewContent } from './HistoricalViewContent';
import { type DiffViewProps } from './ReadOnlyDocumentView';

export type HistoricalDocumentViewProps = {
  documentPath: string | null;
  doc: VersionedDocument | null;
  diffProps: DiffViewProps | null;
  loading: boolean;
  error: string | null;
  showDiff: boolean;
  onSetShowDiff: (value: boolean) => void;
  diffCommitId: CommitId | null;
  onDiffCommitSelect: (id: CommitId) => void;
  canShowDiff: boolean;
  diffSelectorCommits: ChangeWithUrlInfo[];
  title: string;
  titleComponent?: React.ReactNode;
  actions?: React.ReactNode;
};

export const HistoricalDocumentView = ({
  documentPath,
  doc,
  diffProps,
  loading,
  error,
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
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  const isUnsupported = useMemo(
    () => (documentPath ? isUnsupportedExtension(documentPath) : false),
    [documentPath]
  );

  if (isUnsupported) {
    return <UnsupportedDocumentView />;
  }

  return (
    <div className="flex flex-auto flex-col items-center">
      <div className="w-full">
        <DocumentHistoryActionsBar
          title={title}
          titleComponent={titleComponent}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          canShowDiff={canShowDiff}
          showDiff={showDiff}
          onSetShowDiffChecked={onSetShowDiff}
          diffCommitId={diffCommitId}
          history={diffSelectorCommits}
          onDiffCommitSelect={onDiffCommitSelect}
          actions={actions}
        />
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          <HistoricalViewContent
            doc={doc}
            diffProps={diffProps}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
};
