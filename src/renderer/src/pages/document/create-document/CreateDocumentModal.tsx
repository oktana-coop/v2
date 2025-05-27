import { useContext, useState } from 'react';

import { CurrentProjectContext } from '../../../../../modules/editor-state';
import { type VersionControlId } from '../../../../../modules/version-control/';
import { VersionControlContext } from '../../../../../modules/version-control/react';
import { Button } from '../../../components/actions/Button';
import { Modal } from '../../../components/dialogs/Modal';

export const CreateDocumentModal = ({
  isOpen,
  onClose,
  onCreateDocument,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateDocument: (args: {
    documentId: VersionControlId;
    path: string;
  }) => void;
}) => {
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const { projectId, createNewFile } = useContext(CurrentProjectContext);
  const { createDocument: createVersionedDocument } = useContext(
    VersionControlContext
  );

  const handleDocumentCreation = async (title: string) => {
    const file = await createNewFile(title);
    const newDocumentId = await createVersionedDocument({
      name: file.name,
      title,
      path: file.path!,
      projectId,
      content: null,
    });

    setNewDocTitle('');
    onClose();
    onCreateDocument({ documentId: newDocumentId, path: file.path! });
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Give your document a title"
      onClose={() => {
        setNewDocTitle('');
        onClose();
      }}
      secondaryButton={
        <Button
          variant="plain"
          onClick={() => {
            setNewDocTitle('');
            onClose();
          }}
        >
          Cancel
        </Button>
      }
      primaryButton={
        <Button
          disabled={newDocTitle.length === 0}
          onClick={() => handleDocumentCreation(newDocTitle)}
          color="purple"
        >
          Create
        </Button>
      }
    >
      <input
        type="text"
        value={newDocTitle}
        autoFocus={true}
        onChange={(e) => setNewDocTitle(e.target.value)}
        className="w-full rounded-md border border-gray-300 p-2"
      />
    </Modal>
  );
};
