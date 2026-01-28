import { useContext } from 'react';

import { projectTypes } from '../../../../../../modules/domain/project';
import { richTextRepresentations } from '../../../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/browser';
import { removeExtension } from '../../../../../../modules/infrastructure/filesystem';
import {
  CommandPaletteContext,
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../app-state';
import {
  type ActionOption,
  CommandPalette,
} from '../../../../components/dialogs/command-palette';
import {
  useClearWebStorage,
  useCurrentDocumentName,
  useDocumentList,
  useExport,
} from '../../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../hooks/multi-document-project';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../../hooks/single-document-project';
import { keyBindings } from './key-bindings';

export const ProjectCommandPalette = ({
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
  const { canCommit, onOpenCommitDialog, onOpenDiscardChangesDialog } =
    useContext(CurrentDocumentContext);
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
      name: keyBindings.controlO.command,
      shortcut: keyBindings.controlO.keyBinding,
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
      name: keyBindings.controlT.command,
      shortcut: keyBindings.controlT.keyBinding,
      onActionSelection: onCreateDocument,
    },
    ...(projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? []
      : singleDocumentProjectActions),
    ...(isElectron ? electronSpecificActions : browserSpecificActions),
  ];

  const documentActions = [
    ...(canCommit
      ? [
          {
            name: keyBindings.controlS.command,
            shortcut: keyBindings.controlS.keyBinding,
            onActionSelection: onOpenCommitDialog,
          },
          {
            name: 'Discard changes',
            onActionSelection: onOpenDiscardChangesDialog,
          },
        ]
      : []),
    {
      name: keyBindings.controlShiftM.command,
      shortcut: keyBindings.controlShiftM.keyBinding,
      onActionSelection: exportToText(richTextRepresentations.MARKDOWN),
    },
    {
      name: keyBindings.controlShiftH.command,
      shortcut: keyBindings.controlShiftH.keyBinding,
      onActionSelection: exportToText(richTextRepresentations.HTML),
    },
    {
      name: keyBindings.controlShiftW.command,
      shortcut: keyBindings.controlShiftW.keyBinding,
      onActionSelection: exportToBinary(richTextRepresentations.DOCX),
    },
    {
      name: 'Export to Pandoc',
      onActionSelection: exportToText(richTextRepresentations.PANDOC),
    },
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
              actions: documentActions,
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
