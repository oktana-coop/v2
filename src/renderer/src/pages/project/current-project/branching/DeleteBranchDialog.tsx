import { type Branch } from '../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { TrashIcon } from '../../../../components/icons';
import { useBranchInfo } from '../../../../hooks';

type DeleteBranchDialogProps = {
  branch: Branch | null;
  onCancel?: () => void;
};

export const DeleteBranchDialog = ({
  branch,
  onCancel,
}: DeleteBranchDialogProps) => {
  const { deleteBranch } = useBranchInfo();

  const handleDeleteBranch = () => {
    if (branch) {
      deleteBranch(branch);
    }
  };

  return (
    <Modal
      isOpen={branch !== null}
      title="Delete Branch"
      secondaryButton={
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button onClick={handleDeleteBranch} color="red">
          <TrashIcon />
          Delete
        </Button>
      }
    >
      <p>
        Delete branch <em>{branch}</em>?
      </p>
    </Modal>
  );
};
