import { useContext, useMemo } from 'react';

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
  getOpenableDocuments,
  useArtifactSelection,
  useClearWebStorage,
  useCurrentDocumentName,
  useDocumentExplorerTree,
  useExport,
} from '../../../../hooks';
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
  const { checkForUpdate } = useContext(ElectronContext);

  const handleArtifactSelection = useArtifactSelection();
  const currentDocumentName = useCurrentDocumentName();
  const {
    explorerTree: documents,
    selection,
    startCreateDirectory,
  } = useDocumentExplorerTree();
  const clearWebStorage = useClearWebStorage();

  const { exportToText, exportToBinary, exportToPDF } = useExport();

  const openableDocuments = useMemo(
    () => getOpenableDocuments(documents).filter((doc) => doc.id !== selection),
    [documents, selection]
  );

  const projectActions = [
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
    ...projectActions,
    ...electronSpecificActions,
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
      documents={openableDocuments.map((doc) => ({
        id: doc.id,
        title: removeExtension(doc.name),
        onDocumentSelection: () => {
          handleArtifactSelection(doc.id);
          closeCommandPalette();
        },
      }))}
      actions={generalActions}
    />
  );
};
