import { useContext } from 'react';

import { type Branch } from '../../../../../../modules/infrastructure/version-control';
import { ProjectContext } from '../../../../app-state';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { TrashIcon } from '../../../../components/icons';

type DeleteBranchDialogProps = {
  branch: Branch | null;
  onCancel?: () => void;
};

export const DeleteBranchDialog = ({
  branch,
  onCancel,
}: DeleteBranchDialogProps) => {
  const { deleteBranch } = useContext(ProjectContext);

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
        <Button onClick={handleDeleteBranch} color="red" autoFocus>
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
