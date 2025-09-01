import { useContext, useState } from 'react';

import { projectTypes } from '../../../../../modules/domain/project';
import { richTextRepresentations } from '../../../../../modules/domain/rich-text';
import { removeExtension } from '../../../../../modules/infrastructure/filesystem';
import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../app-state';
import { CommandPalette } from '../../../components/dialogs/command-palette/CommandPalette';
import { useDocumentList, useKeyBindings } from '../../../hooks';
import { useCurrentDocumentName } from '../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../hooks/multi-document-project';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../hooks/single-document-project';
import { useExport } from '../../../hooks/use-export';

export const DocumentCommandPalette = ({
  onCreateDocument,
  onOpenDocument,
}: {
  onCreateDocument: () => void;
  onOpenDocument: () => void;
}) => {
  const [isCommandPaletteOpen, setCommandPaletteOpen] =
    useState<boolean>(false);
  const { projectType } = useContext(CurrentProjectContext);
  const { canCommit, onOpenCommitDialog } = useContext(CurrentDocumentContext);

  // here we register the key bindings that are not
  // already covered by the command palette
  // as the command palette is registering any actions having shortcuts
  useKeyBindings({
    'ctrl+k': () => setCommandPaletteOpen((state) => !state),
  });

  const handleDocumentSelectionInMultiDocumentProject =
    useDocumentSelectionInMultiDocumentProject();
  const handleDocumentSelectionInSingleDocumentProject =
    useDocumentSelectionInSingleDocumentProject();
  const currentDocumentName = useCurrentDocumentName();
  const { documentList: documents } = useDocumentList();

  const handleDocumentSelection =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? handleDocumentSelectionInMultiDocumentProject
      : handleDocumentSelectionInSingleDocumentProject;

  const { exportToText, exportToBinary, exportToPDF } = useExport();

  const singleDocumentProjectActions = [
    {
      name: 'Open document',
      shortcut: 'O',
      onActionSelection: onOpenDocument,
    },
  ];

  return (
    <CommandPalette
      open={isCommandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
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
                  name: 'Export to PDF',
                  shortcut: 'P',
                  onActionSelection: exportToPDF,
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
            setCommandPaletteOpen(false);
          },
        }))}
      actions={[
        {
          name: 'Create new document',
          shortcut: 'D',
          onActionSelection: onCreateDocument,
        },
        ...singleDocumentProjectActions,
      ]}
    />
  );
};
