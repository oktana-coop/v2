import React, { useState } from 'react';

import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { BranchIcon } from '../../../../components/icons';
import { Input } from '../../../../components/inputs/Input';

type CreateBranchDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
  onCreateBranch: (branchName: string) => void;
};

export const CreateBranchDialog = ({
  isOpen = false,
  onCancel,
  onCreateBranch,
}: CreateBranchDialogProps) => {
  const [branchName, setBranchName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleCreateBranchSubmission = () => {
    if (branchName.length === 0) {
      return setErrorMessage('Branch name cannot be empty.');
    }
    onCreateBranch(branchName);
    setBranchName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // on Escape key press
    if (onCancel && e.key === 'Escape') {
      setBranchName('');
      onCancel();
    }
    // on enter --> submit
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateBranchSubmission();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Create branch"
      secondaryButton={
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button onClick={handleCreateBranchSubmission} color="purple">
          <BranchIcon />
          Create Branch
        </Button>
      }
    >
      <Input
        className="w-full"
        autoFocus={true}
        autoComplete="off"
        onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
          setErrorMessage('');
          setBranchName(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
    </Modal>
  );
};
