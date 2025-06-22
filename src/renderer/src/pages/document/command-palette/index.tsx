import { useContext, useState } from 'react';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../../modules/app-state';
import { projectTypes } from '../../../../../modules/domain/project';
import { removeExtension } from '../../../../../modules/infrastructure/filesystem';
import { CommandPalette } from '../../../components/dialogs/command-palette/CommandPalette';
import { useDocumentList, useKeyBindings } from '../../../hooks';
import { useCurrentDocumentName } from '../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../hooks/multi-document-project';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../hooks/single-document-project';

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
  const { selectedFileInfo, canCommit, onOpenCommitDialog } = useContext(
    CurrentDocumentContext
  );
  useKeyBindings({
    'ctrl+k': () => setCommandPaletteOpen((state) => !state),
    'ctrl+d': () => onCreateDocument(),
  });
  const handleDocumentSelectionInMultiDocumentProject =
    useDocumentSelectionInMultiDocumentProject();
  const handleDocumentSelectionInSingleDocumentProject =
    useDocumentSelectionInSingleDocumentProject();
  const currentDocumentName = useCurrentDocumentName();
  const documents = useDocumentList();

  const handleDocumentSelection =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? handleDocumentSelectionInMultiDocumentProject
      : handleDocumentSelectionInSingleDocumentProject;

  const singleDocumentProjectActions = [
    {
      name: 'Open document',
      shortcut: 'O',
      onActionSelection: onOpenDocument,
    },
  ];

  console.log(documents);

  return (
    <CommandPalette
      open={isCommandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      documentsGroupTitle={`${selectedFileInfo ? 'Other' : 'Project'}  documents`}
      contextualSection={
        currentDocumentName
          ? {
              groupTitle: `Current document: ${currentDocumentName}`,
              actions: [
                ...(canCommit
                  ? [
                      {
                        name: 'Commit changes',
                        shortcut: 'S',
                        onActionSelection: () => {
                          console.log('Commit changes action selected');
                          onOpenCommitDialog();
                        },
                      },
                    ]
                  : []),
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
