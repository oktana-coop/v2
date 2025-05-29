import { useContext, useState } from 'react';

import { CurrentProjectContext } from '../../../../../modules/app-state';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control/';
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
  const { createNewDocument } = useContext(CurrentProjectContext);

  const handleDocumentCreation = async (title: string) => {
    const { documentId, path } = await createNewDocument(title);

    setNewDocTitle('');
    onClose();
    onCreateDocument({ documentId, path });
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
