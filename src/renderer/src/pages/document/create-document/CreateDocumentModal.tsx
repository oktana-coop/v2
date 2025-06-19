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
  const [newDocName, setNewDocName] = useState<string>('');
  const { createNewDocument } = useContext(CurrentProjectContext);

  const handleDocumentCreation = async (title: string) => {
    const { documentId, path } = await createNewDocument(title);

    setNewDocName('');
    onClose();
    onCreateDocument({ documentId, path });
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Give your document a title"
      onClose={() => {
        setNewDocName('');
        onClose();
      }}
      secondaryButton={
        <Button
          variant="plain"
          onClick={() => {
            setNewDocName('');
            onClose();
          }}
        >
          Cancel
        </Button>
      }
      primaryButton={
        <Button
          disabled={newDocName.length === 0}
          onClick={() => handleDocumentCreation(newDocName)}
          color="purple"
        >
          Create
        </Button>
      }
    >
      <input
        type="text"
        value={newDocName}
        autoFocus={true}
        onChange={(e) => setNewDocName(e.target.value)}
        className="w-full rounded-md border border-gray-300 p-2"
      />
    </Modal>
  );
};
