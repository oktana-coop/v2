import { useContext, useState } from 'react';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../../modules/app-state';
import { projectTypes } from '../../../../../modules/domain/project';
import { removeExtension } from '../../../../../modules/infrastructure/filesystem';
import { CommandPalette } from '../../../components/dialogs/command-palette/CommandPalette';
import {
  useCurrentDocumentName as useCurrentDocumentNameInMultiDocumentProject,
  useDocumentList as useDocumentListInMultiDocumentProject,
  useDocumentSelection as useDocumentSelectionInMultiDocumentProject,
} from '../../../hooks/multi-document-project';
import {
  useCurrentDocumentName as useCurrentDocumentNameInSingleDocumentProject,
  useDocumentList as useDocumentListInSingleDocumentProject,
  useDocumentSelection as useDocumentSelectionInSingleDocumentProject,
} from '../../../hooks/single-document-project';
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
  const getCurrentDocumentNameInMultiDocumentProject =
    useCurrentDocumentNameInMultiDocumentProject();
  const getCurrentDocumentNameInSingleDocumentProject =
    useCurrentDocumentNameInSingleDocumentProject();
  const getDocumentListInMultiDocumentProject =
    useDocumentListInMultiDocumentProject();
  const getDocumentListInSingleDocumentProject =
    useDocumentListInSingleDocumentProject();

  const handleDocumentSelection =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? handleDocumentSelectionInMultiDocumentProject
      : handleDocumentSelectionInSingleDocumentProject;

  const documentName =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? getCurrentDocumentNameInMultiDocumentProject()
      : getCurrentDocumentNameInSingleDocumentProject();

  const documents = projectTypes.MULTI_DOCUMENT_PROJECT
    ? getDocumentListInMultiDocumentProject()
    : getDocumentListInSingleDocumentProject();

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
        documentName
          ? {
              groupTitle: `Current document: ${documentName}`,
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
