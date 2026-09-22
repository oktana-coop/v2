import { useCallback, useState } from 'react';

import { type ShareId } from '../../../../../../modules/domain/project';
import { type Branch } from '../../../../../../modules/infrastructure/version-control';
import { type JoinSharedDocumentRefusal } from '../../../../app-state';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { BranchIcon, GroupIcon } from '../../../../components/icons';
import { Input } from '../../../../components/inputs/Input';

export type JoinRefusal = JoinSharedDocumentRefusal;

export type JoinSharedDocumentDialogProps = {
  isOpen?: boolean;
  description?: string;
  // Resolves to why the join was refused, or null once it went through.
  onJoin: (shareId: ShareId) => Promise<JoinRefusal | null>;
  onOpenAsGuest?: (shareId: ShareId) => void;
  // Offered when the share lives on another branch this project has.
  onSwitchToBranchAndJoin?: (args: {
    shareId: ShareId;
    branch: Branch;
  }) => Promise<JoinRefusal | null>;
  onCancel: () => void;
};

const refusalText = (refusal: JoinRefusal) => {
  if (refusal.reason === 'not-in-project')
    return 'The share belongs to a document this project does not have.';

  return refusal.canSwitch
    ? `The share belongs to branch "${refusal.branch}".`
    : `The share belongs to branch "${refusal.branch}", which this project does not have.`;
};

export const JoinSharedDocumentDialog = ({
  isOpen,
  description = 'Paste the share ID you were sent. It opens the shared document in this project.',
  onJoin,
  onOpenAsGuest,
  onSwitchToBranchAndJoin,
  onCancel,
}: JoinSharedDocumentDialogProps) => {
  const [link, setLink] = useState('');
  const [refusal, setRefusal] = useState<JoinRefusal | null>(null);

  const handleJoin = useCallback(async () => {
    const shareId = link.trim();

    if (!shareId) return;

    const outcome = await onJoin(shareId);
    setRefusal(outcome);
    if (outcome === null) setLink('');
  }, [link, onJoin]);

  const handleCancel = useCallback(() => {
    setLink('');
    setRefusal(null);
    onCancel();
  }, [onCancel]);

  const handleOpenAsGuest = useCallback(() => {
    const shareId = link.trim();

    if (!shareId || !onOpenAsGuest) return;

    onOpenAsGuest(shareId);
    handleCancel();
  }, [link, onOpenAsGuest, handleCancel]);

  const handleSwitchToBranchAndJoin = useCallback(
    async (branch: Branch) => {
      const shareId = link.trim();

      if (!shareId || !onSwitchToBranchAndJoin) return;

      const outcome = await onSwitchToBranchAndJoin({ shareId, branch });
      setRefusal(outcome);
      if (outcome === null) setLink('');
    },
    [link, onSwitchToBranchAndJoin]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Join Shared Document"
      secondaryButton={
        <Button variant="plain" onClick={handleCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button color="purple" onClick={handleJoin} disabled={!link.trim()}>
          Join
        </Button>
      }
    >
      <div className="space-y-3">
        <p>{description}</p>
        <Input
          type="text"
          value={link}
          autoFocus
          placeholder="Share ID"
          onChange={(event) => {
            setLink(event.target.value);
            setRefusal(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleJoin();
          }}
        />
        {refusal && (
          <div className="space-y-2" data-testid="join-refusal">
            <p className="text-sm text-red-600 dark:text-red-400">
              {refusalText(refusal)}
            </p>
            {refusal.reason === 'not-in-project' && onOpenAsGuest && (
              <Button
                variant="plain"
                color="purple"
                onClick={handleOpenAsGuest}
              >
                <GroupIcon className="mr-1" />
                Open as guest instead
              </Button>
            )}
            {refusal.reason === 'other-branch' &&
              refusal.canSwitch &&
              onSwitchToBranchAndJoin && (
                <Button
                  variant="plain"
                  color="purple"
                  onClick={() => handleSwitchToBranchAndJoin(refusal.branch)}
                >
                  <BranchIcon className="mr-1" />
                  Switch to {refusal.branch}
                </Button>
              )}
          </div>
        )}
      </div>
    </Modal>
  );
};
