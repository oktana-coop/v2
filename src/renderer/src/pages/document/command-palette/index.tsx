import { useContext } from 'react';

import { projectTypes } from '../../../../../modules/domain/project';
import { richTextRepresentations } from '../../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform';
import { removeExtension } from '../../../../../modules/infrastructure/filesystem';
import {
  CommandPaletteContext,
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../app-state';
import {
  type ActionOption,
  CommandPalette,
} from '../../../components/dialogs/command-palette/CommandPalette';
import {
  useClearWebStorage,
  useCurrentDocumentName,
  useDocumentList,
  useExport,
} from '../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../hooks/multi-document-project';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../hooks/single-document-project';

export const DocumentCommandPalette = ({
  onCreateDocument,
  onOpenDocument,
}: {
  onCreateDocument: () => void;
  onOpenDocument: () => void;
}) => {
  const { isOpen: isCommandPaletteOpen, closeCommandPalette } = useContext(
    CommandPaletteContext
  );
  const { projectType } = useContext(CurrentProjectContext);
  const { canCommit, onOpenCommitDialog } = useContext(CurrentDocumentContext);
  const { isElectron, checkForUpdate } = useContext(ElectronContext);

  const handleDocumentSelectionInMultiDocumentProject =
    useDocumentSelectionInMultiDocumentProject();
  const handleDocumentSelectionInSingleDocumentProject =
    useDocumentSelectionInSingleDocumentProject();
  const currentDocumentName = useCurrentDocumentName();
  const { documentList: documents } = useDocumentList();
  const clearWebStorage = useClearWebStorage();

  const handleDocumentSelection =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? handleDocumentSelectionInMultiDocumentProject
      : handleDocumentSelectionInSingleDocumentProject;

  const { exportToText, exportToBinary } = useExport();

  const singleDocumentProjectActions = [
    {
      name: 'Open document',
      shortcut: 'O',
      onActionSelection: onOpenDocument,
    },
  ];

  const electronSpecificActions: ActionOption[] = [
    {
      name: 'Check for updates',
      onActionSelection: checkForUpdate,
    },
    {
      name: 'Clear application data',
      onActionSelection: clearWebStorage,
    },
  ];

  const browserSpecificActions: ActionOption[] = [];

  const generalActions = [
    {
      name: 'Create new document',
      shortcut: 'D',
      onActionSelection: onCreateDocument,
    },
    ...singleDocumentProjectActions,
    ...(isElectron ? electronSpecificActions : browserSpecificActions),
  ];

  return (
    <CommandPalette
      open={isCommandPaletteOpen}
      onClose={closeCommandPalette}
      documentsGroupTitle={`${projectType === projectTypes.SINGLE_DOCUMENT_PROJECT ? 'Other' : 'Project'}  documents`}
      contextualSection={
        currentDocumentName
          ? {
              groupTitle: `Current document: ${currentDocumentName}`,
              actions: [
                {
                  name: 'Commit changes',
                  shortcut: 'S',
                  onActionSelection: () => {
                    if (canCommit) {
                      return onOpenCommitDialog();
                    }
                    // TODO: display a toast notification sort of type
                    alert('All saved! No changes to commit!');
                  },
                },
                {
                  name: 'Export to Markdown',
                  shortcut: 'M',
                  onActionSelection: exportToText(
                    richTextRepresentations.MARKDOWN
                  ),
                },
                {
                  name: 'Export to HTML',
                  shortcut: 'H',
                  onActionSelection: exportToText(richTextRepresentations.HTML),
                },
                {
                  name: 'Export to Docx (Microsoft Word)',
                  shortcut: 'W',
                  onActionSelection: exportToBinary(
                    richTextRepresentations.DOCX
                  ),
                },
                {
                  name: 'Export to Pandoc',
                  onActionSelection: exportToText(
                    richTextRepresentations.PANDOC
                  ),
                },
              ],
            }
          : undefined
      }
      documents={documents
        .filter((doc) => !doc.isSelected)
        .map((doc) => ({
          title: removeExtension(doc.name),
          onDocumentSelection: () => {
            handleDocumentSelection(doc.id);
            closeCommandPalette();
          },
        }))}
      actions={generalActions}
    />
  );
};
