import { Button } from '../../../components/actions/Button';
import { Modal } from '../../../components/dialogs/Modal';
import { TrashIcon } from '../../../components/icons';

type DiscardChangesDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
  onDiscardChanges: () => void;
};

export const DiscardChangesDialog = ({
  isOpen = false,
  onCancel,
  onDiscardChanges,
}: DiscardChangesDialogProps) => (
  <Modal
    isOpen={isOpen}
    title="Discard Changes"
    secondaryButton={
      <Button variant="plain" onClick={onCancel}>
        Cancel
      </Button>
    }
    primaryButton={
      <Button onClick={onDiscardChanges} color="red">
        <TrashIcon />
        Discard
      </Button>
    }
  >
    <p>Discard uncommitted changes?</p>
  </Modal>
);
