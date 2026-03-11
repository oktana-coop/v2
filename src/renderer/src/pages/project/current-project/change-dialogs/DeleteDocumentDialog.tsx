import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { TrashIcon } from '../../../../components/icons';

type DeleteDocumentDialogProps = {
  isOpen: boolean;
  documentName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteDocumentDialog = ({
  isOpen,
  documentName,
  onCancel,
  onConfirm,
}: DeleteDocumentDialogProps) => (
  <Modal
    isOpen={isOpen}
    title="Delete Document"
    secondaryButton={
      <Button variant="plain" onClick={onCancel}>
        Cancel
      </Button>
    }
    primaryButton={
      <Button onClick={onConfirm} color="red">
        <TrashIcon />
        Delete
      </Button>
    }
  >
    <p>
      Delete document <strong>{documentName}</strong>?
    </p>
  </Modal>
);
