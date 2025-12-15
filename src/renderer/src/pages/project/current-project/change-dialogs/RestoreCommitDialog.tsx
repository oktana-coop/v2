import React, { useContext, useEffect, useState } from 'react';

import { type Commit } from '../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../app-state';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon } from '../../../../components/icons/Check';
import { Textarea } from '../../../../components/inputs/Textarea';

type RestoreCommitDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
  onRestoreCommit: (args: { message: string; commit: Commit }) => void;
};

export const RestoreCommitDialog = ({
  isOpen = false,
  onCancel,
  onRestoreCommit,
}: RestoreCommitDialogProps) => {
  const { commitToRestore } = useContext(CurrentDocumentContext);

  const [commitMessage, setCommitMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (commitToRestore) {
      setCommitMessage(`Restore "${commitToRestore.message.trimEnd()}"`);
    } else {
      setCommitMessage('');
    }
  }, [commitToRestore]);

  const handleRestoreCommitSubmission = () => {
    if (!commitToRestore) {
      return setErrorMessage('No commit selected to restore.');
    }

    if (commitMessage.trim().length === 0) {
      return setErrorMessage('Message cannot be empty.');
    }
    onRestoreCommit({ message: commitMessage, commit: commitToRestore });
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
      if (!commitToRestore) return;
      e.preventDefault();
      handleRestoreCommitSubmission();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={`Restore commit${commitToRestore ? `: "${commitToRestore.message.trimEnd()}"` : ''}`}
      secondaryButton={
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button
          onClick={handleRestoreCommitSubmission}
          color="purple"
          disabled={!commitToRestore || !commitMessage.trim()}
        >
          <CheckIcon />
          Restore
        </Button>
      }
    >
      <Textarea
        className="h-full w-full resize-none border-gray-400 shadow-inner outline-none"
        autoFocus={true}
        autoComplete="off"
        rows={3}
        value={commitMessage}
        onInput={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          setErrorMessage('');
          setCommitMessage(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
    </Modal>
  );
};
