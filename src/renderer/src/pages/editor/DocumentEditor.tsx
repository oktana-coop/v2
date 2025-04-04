import { useCallback, useContext, useEffect, useState } from 'react';

import { ProseMirrorContext } from '../../../../modules/rich-text/react/context';
import { type VersionedDocumentHandle } from '../../../../modules/version-control';
import { CommandPalette } from '../../components/dialogs/command-palette/CommandPalette';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { useKeyBindings } from '../../hooks/useKeyBindings';
import { ActionsBar } from './ActionsBar';
import { CommitDialog } from './CommitDialog';

export const DocumentEditor = ({
  versionedDocumentHandle,
  isSidebarOpen,
  onSidebarToggle,
}: {
  versionedDocumentHandle: VersionedDocumentHandle;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
}) => {
  const [isCommitting, openCommitDialog] = useState<boolean>(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] =
    useState<boolean>(false);
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);

  useKeyBindings({
    'ctrl+k': () => setCommandPaletteOpen((state) => !state),
  });

  useEffect(() => {
    if (versionedDocumentHandle) {
      document.title = `v2 | editing "${versionedDocumentHandle.docSync()?.title}"`;
    }
  }, [versionedDocumentHandle]);

  const commitChanges = (message: string) => {
    if (!versionedDocumentHandle) return;

    versionedDocumentHandle.change(
      (doc) => {
        // this is effectively a no-op, but it triggers a change event
        // (not) changing the title of the document, as interfering with the
        // content outside the Prosemirror API will cause loss of formatting
        // eslint-disable-next-line no-self-assign
        doc.title = doc.title;
      },
      {
        message,
        time: new Date().getTime(),
      }
    );

    openCommitDialog(false);
  };

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  const handleSave = useCallback(() => {
    openCommitDialog(true);
  }, []);

  return (
    <>
      <CommitDialog
        isOpen={isCommitting}
        onCancel={() => openCommitDialog(false)}
        onCommit={(message: string) => commitChanges(message)}
      />
      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        documentsGroupTitle={'Recently opened documents'}
        documents={[
          {
            id: '1',
            title: 'Flow collaboration workflow',
            onDocumentSelection: () =>
              console.log('Flow collaboration workflow clicked'),
          },
        ]}
        actions={[
          {
            name: 'Commit changes',
            shortcut: 'S',
            onActionSelection: () => openCommitDialog(true),
          },
        ]}
      />
      <div className="relative flex flex-auto flex-col items-stretch overflow-hidden">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={onSidebarToggle}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          onCheckIconClick={handleSave}
        />
        <RichTextEditor
          docHandle={versionedDocumentHandle}
          onSave={handleSave}
          isToolbarOpen={isEditorToolbarOpen}
        />
      </div>
    </>
  );
};
