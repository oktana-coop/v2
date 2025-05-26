import { useState } from 'react';

import { Button } from '../../../components/actions/Button';
import { Modal } from '../../../components/dialogs/Modal';

export const CreateDocumentModal = ({
  isOpen,
  onClose,
  onCreateDocument,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateDocument: (title: string) => Promise<void>;
}) => {
  const [newDocTitle, setNewDocTitle] = useState<string>('');

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
          onClick={async () => {
            await onCreateDocument(newDocTitle);
            setNewDocTitle('');
            onClose();
          }}
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
