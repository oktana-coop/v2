import { useState } from 'react';

import { type ProjectId } from '../../../../../modules/domain/project';
import { type ResolvedArtifactId } from '../../../../../modules/infrastructure/version-control/';
import { Button } from '../../../components/actions/Button';
import { Modal } from '../../../components/dialogs/Modal';
import { useCreateDocument } from '../../../hooks';

export const CreateDocumentModal = ({
  isOpen,
  onClose,
  onCreateDocument,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateDocument: (args: {
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    path: string | null;
  }) => void;
}) => {
  const [newDocName, setNewDocName] = useState<string>('');
  const { createNewDocument } = useCreateDocument();

  const handleDocumentCreation = async (title: string) => {
    const { projectId, documentId, path } = await createNewDocument(title);

    setNewDocName('');
    onClose();
    onCreateDocument({ projectId, documentId, path });
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
