import { useContext } from 'react';

import {
  CloneFromGithubModalContext,
  SidebarLayoutContext,
  useCreateDocument,
} from '../../../../app-state';
import { Button } from '../../../../components/actions/Button';
import { EmptyDocument } from '../../../../components/document-views/EmptyDocument';
import { FolderIcon, GithubIcon, PenIcon } from '../../../../components/icons';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';
import { useDocumentExplorerTree } from '../../shared/explorer-tree-views';

export const EmptyMainView = ({
  onCreateDocumentButtonClick,
  onOpenDirectoryButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
  onOpenDirectoryButtonClick: () => void;
}) => {
  const { openCloneFromGithubModal } = useContext(CloneFromGithubModalContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  const { explorerTree: documents } = useDocumentExplorerTree();
  const { canCreateDocument } = useCreateDocument();

  const openProjectPrompt =
    'Open a folder to organize your versioned documents';

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <DefaultActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
        />
      </div>
      <EmptyDocument
        message={
          documents.length > 0
            ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
            : openProjectPrompt
        }
      >
        <Button
          onClick={onOpenDirectoryButtonClick}
          variant="plain"
          color="purple"
        >
          <FolderIcon className="mr-1" />
          Open folder
        </Button>
        {canCreateDocument && (
          <Button
            onClick={onCreateDocumentButtonClick}
            variant="plain"
            color="purple"
          >
            <PenIcon className="mr-1" />
            Create document
          </Button>
        )}
        <Button
          onClick={openCloneFromGithubModal}
          variant="plain"
          color="neutral"
          className="w-64"
        >
          <GithubIcon className="mr-1" />
          Clone from GitHub
        </Button>
      </EmptyDocument>
    </div>
  );
};
