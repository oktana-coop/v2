import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { TrashIcon } from '../../../../components/icons';

type DeleteDirectoryDialogProps = {
  isOpen: boolean;
  directoryName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteDirectoryDialog = ({
  isOpen,
  directoryName,
  onCancel,
  onConfirm,
}: DeleteDirectoryDialogProps) => (
  <Modal
    isOpen={isOpen}
    title="Delete Folder"
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
      Delete folder <strong>{directoryName}</strong> and all its contents?
    </p>
  </Modal>
);
