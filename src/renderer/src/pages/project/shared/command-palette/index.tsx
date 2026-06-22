import { useContext } from 'react';

import { richTextRepresentations } from '../../../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/browser';
import { removeExtension } from '../../../../../../modules/infrastructure/filesystem';
import {
  CommandPaletteContext,
  CommitModalContext,
  CurrentDocumentContext,
} from '../../../../app-state';
import {
  type ActionOption,
  CommandPalette,
} from '../../../../components/dialogs/command-palette';
import {
  useClearWebStorage,
  useCurrentDocumentName,
  useDocumentExplorerTree,
  useExport,
} from '../../../../hooks';
import { useArtifactSelection as useArtifactSelectionInMultiDocumentProject } from '../../../../hooks/multi-document-project';
import { keyBindings } from './key-bindings';

export const ProjectCommandPalette = ({
  onCreateDocument,
  onOpenProjectSettings,
  onOpenPrintPreview,
}: {
  onCreateDocument: () => void;
  onOpenProjectSettings: () => void;
  onOpenPrintPreview: () => void;
}) => {
  const { isOpen: isCommandPaletteOpen, closeCommandPalette } = useContext(
    CommandPaletteContext
  );
  const { canCommit, onOpenDiscardChangesDialog } = useContext(
    CurrentDocumentContext
  );
  const { openCommitModal } = useContext(CommitModalContext);
  const { isElectron, checkForUpdate } = useContext(ElectronContext);

  const handleDocumentSelection = useArtifactSelectionInMultiDocumentProject();
  const currentDocumentName = useCurrentDocumentName();
  const {
    explorerTree: documents,
    selection,
    startCreateDirectory,
  } = useDocumentExplorerTree();
  const clearWebStorage = useClearWebStorage();

  const { exportToText, exportToBinary, exportToPDF } = useExport();

  const multiDocumentProjectActions = [
    {
      name: keyBindings.ctrlAltN.command,
      shortcut: keyBindings.ctrlAltN.keyBinding,
      onActionSelection: () => startCreateDirectory(),
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
      name: keyBindings.ctrlN.command,
      shortcut: keyBindings.ctrlN.keyBinding,
      onActionSelection: onCreateDocument,
    },
    {
      name: keyBindings.ctrlComma.command,
      shortcut: keyBindings.ctrlComma.keyBinding,
      onActionSelection: onOpenProjectSettings,
    },
    ...multiDocumentProjectActions,
    ...(isElectron ? electronSpecificActions : browserSpecificActions),
  ];

  const documentActions = [
    ...(canCommit
      ? [
          {
            name: keyBindings.ctrlS.command,
            shortcut: keyBindings.ctrlS.keyBinding,
            onActionSelection: openCommitModal,
          },
          {
            name: 'Discard changes',
            onActionSelection: onOpenDiscardChangesDialog,
          },
        ]
      : []),
    {
      name: keyBindings.ctrlShiftM.command,
      shortcut: keyBindings.ctrlShiftM.keyBinding,
      onActionSelection: exportToText(richTextRepresentations.MARKDOWN),
    },
    {
      name: keyBindings.ctrlShiftH.command,
      shortcut: keyBindings.ctrlShiftH.keyBinding,
      onActionSelection: exportToText(richTextRepresentations.HTML),
    },
    {
      name: keyBindings.ctrlShiftW.command,
      shortcut: keyBindings.ctrlShiftW.keyBinding,
      onActionSelection: exportToBinary(richTextRepresentations.DOCX),
    },
    {
      name: keyBindings.ctrlShiftP.command,
      shortcut: keyBindings.ctrlShiftP.keyBinding,
      onActionSelection: exportToPDF,
    },
    {
      name: keyBindings.ctrlAltP.command,
      shortcut: keyBindings.ctrlAltP.keyBinding,
      onActionSelection: onOpenPrintPreview,
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
      documentsGroupTitle="Project documents"
      contextualSection={
        currentDocumentName
          ? {
              groupTitle: `Current document: ${currentDocumentName}`,
              actions: documentActions,
            }
          : undefined
      }
      documents={documents
        .filter((doc) => doc.id !== selection)
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
