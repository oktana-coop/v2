import { useCallback, useState } from 'react';

import { type ShareId } from '../../../../modules/domain/project';
import { type Participant } from '../../../../modules/domain/rich-text';
import { Button } from '../../components/actions/Button';
import { Modal } from '../../components/dialogs/Modal';
import { CheckIcon, CopyIcon } from '../../components/icons';

export type GuestSharingDialogProps = {
  isOpen?: boolean;
  shareId: ShareId | null;
  participants: Participant[];
  onLeave: () => Promise<void>;
  onCancel: () => void;
};

export const GuestSharingDialog = ({
  isOpen,
  shareId,
  participants,
  onLeave,
  onCancel,
}: GuestSharingDialogProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    if (!shareId) return;

    await navigator.clipboard.writeText(shareId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeButton
      title="Shared document"
      secondaryButton={
        <Button variant="plain" onClick={onLeave}>
          Leave
        </Button>
      }
      primaryButton={
        <Button color="purple" onClick={handleCopyLink}>
          {copied ? (
            <CheckIcon className="mr-1" />
          ) : (
            <CopyIcon className="mr-1" />
          )}
          {copied ? 'Copied' : 'Copy share ID'}
        </Button>
      }
    >
      <div className="space-y-4">
        <p>Anyone with this share ID can edit this document with you.</p>
        <p
          className="cursor-text select-all truncate rounded border border-zinc-950/10 bg-zinc-950/[2.5%] px-3 py-2 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
          title={shareId ?? undefined}
          data-testid="share-id"
        >
          {shareId}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {participants.length === 0
            ? 'Nobody else is here right now.'
            : `Here now: ${participants.map((participant) => participant.name).join(', ')}.`}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Leaving removes this document from your list. Others keep the shared
          version, and the link joins it again.
        </p>
      </div>
    </Modal>
  );
};
