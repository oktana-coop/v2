import React, { useState } from 'react';

import { Button } from '../../../../components/actions/Button';
import { SplitButton } from '../../../../components/actions/SplitButton';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon } from '../../../../components/icons/Check';
import { Textarea } from '../../../../components/inputs/Textarea';

export type CommitOption = {
  label: string;
  description?: string;
  onCommit: (message: string) => void;
};

type CommitDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
  canCommit: boolean;
  primaryAction: CommitOption;
  secondaryActions?: CommitOption[];
};

export const CommitDialog = ({
  isOpen = false,
  onCancel,
  canCommit,
  primaryAction,
  secondaryActions = [],
}: CommitDialogProps) => {
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const submit = (handler: (message: string) => void) => {
    if (commitMessage.length === 0) {
      return setErrorMessage('Commit message cannot be empty.');
    }
    handler(commitMessage);
    setCommitMessage('');
  };

  const handlePrimary = () => submit(primaryAction.onCommit);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // on Escape key press
    if (onCancel && e.key === 'Escape') {
      setCommitMessage('');
      onCancel();
    }
    // on cmd/ctrl + enter --> submit the primary commit action
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePrimary();
    }
  };

  const primaryButton =
    secondaryActions.length > 0 ? (
      <SplitButton
        primaryLabel={
          <>
            <CheckIcon />
            Commit
          </>
        }
        onPrimaryClick={handlePrimary}
        primaryTooltip={primaryAction.description ?? primaryAction.label}
        disabled={!canCommit}
        color="purple"
        toggleAriaLabel="More commit options"
        menuLabel="Other commit options"
        menuItems={secondaryActions.map((action) => ({
          label: action.label,
          description: action.description,
          onClick: () => submit(action.onCommit),
          disabled: !canCommit,
        }))}
      />
    ) : (
      <Button onClick={handlePrimary} color="purple" disabled={!canCommit}>
        <CheckIcon />
        Commit
      </Button>
    );

  return (
    <Modal
      isOpen={isOpen}
      title="Commit changes"
      secondaryButton={
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      }
      primaryButton={primaryButton}
    >
      <Textarea
        className="h-full w-full resize-none border-gray-400 shadow-inner outline-none"
        autoFocus={true}
        autoComplete="off"
        rows={3}
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
