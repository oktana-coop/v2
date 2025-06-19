import { useContext, useState } from 'react';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../../modules/app-state';
import { projectTypes } from '../../../../../modules/domain/project';
import { removeExtension } from '../../../../../modules/infrastructure/filesystem';
import { CommandPalette } from '../../../components/dialogs/command-palette/CommandPalette';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../hooks/multi-document-project';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../hooks/single-document-project';
import { useKeyBindings } from '../../../hooks/useKeyBindings';

export const DocumentCommandPalette = ({
  onCreateDocument,
  onOpenDocument,
}: {
  onCreateDocument: () => void;
  onOpenDocument: () => void;
}) => {
  const [isCommandPaletteOpen, setCommandPaletteOpen] =
    useState<boolean>(false);
  const { projectType, files } = useContext(CurrentProjectContext);
  const { selectedFileInfo, selectedFileName, canCommit, onOpenCommitDialog } =
    useContext(CurrentDocumentContext);
  useKeyBindings({
    'ctrl+k': () => setCommandPaletteOpen((state) => !state),
    'ctrl+d': () => onCreateDocument(),
  });
  const handleDocumentSelectionInMultiDocumentProject =
    useDocumentSelectionInMultiDocumentProject();
  const handleDocumentSelectionInSingleDocumentProject =
    useDocumentSelectionInSingleDocumentProject();

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

  return (
    <CommandPalette
      open={isCommandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      documentsGroupTitle={`${selectedFileInfo ? 'Other' : 'Project'}  documents`}
      contextualSection={
        selectedFileName
          ? {
              groupTitle: `Current document: ${selectedFileName}`,
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
      documents={files
        .filter((file) => selectedFileInfo?.path !== file.path)
        .map((file) => ({
          title: removeExtension(file.name),
          onDocumentSelection: () => {
            handleDocumentSelection(file);
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
