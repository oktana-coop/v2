import React, { useState } from 'react';
import { Button } from '../components/actions/Button';
import { Modal } from '../components/dialogs/Modal';
import { CheckIcon } from '../components/icons/Check';

type CommitDialogProps = {
  onCommit: (message: string) => void;
  onCancel?: () => void;
  isOpen?: boolean;
};

export const CommitDialog = ({
  isOpen = false,
  onCancel,
  onCommit,
}: CommitDialogProps) => {
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleCommitSubmission = () => {
    if (commitMessage.length === 0) {
      return setErrorMessage('Commit message cannot be empty.');
    }
    onCommit(commitMessage);
    setCommitMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // on Escape key press
    if (onCancel && e.key === 'Escape') {
      setCommitMessage('');
      onCancel();
    }
    // on cmd/ctrl + enter --> submit the commit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommitSubmission();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Commit changes"
      description="Are you sure you want to commit these changes?"
      secondaryButton={<Button onClick={onCancel}>Cancel</Button>}
      primaryButton={
        <Button onClick={handleCommitSubmission} variant="solid" color="purple">
          <CheckIcon />
          Commit
        </Button>
      }
    >
      <textarea
        className="shadow-inner w-full h-full resize-none p-3 text-black bg-white rounded-sm outline-none border-gray-400"
        //  did not manage to make autoFocus work
        autoFocus={true}
        rows={3}
        onInput={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          setErrorMessage('');
          setCommitMessage(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <p className="text-red-500 text-sm">{errorMessage}</p>
    </Modal>
  );
};
