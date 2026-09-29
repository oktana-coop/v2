import { useCallback, useState } from 'react';

import { type ShareId } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon, CopyIcon } from '../../../../components/icons';

export type ShareDocumentDialogProps = {
  isOpen?: boolean;
  shareId: ShareId | null;
  // Resolves to the new share ID, or null when sharing did not happen.
  onShare: () => Promise<ShareId | null>;
  onStopSharing: () => Promise<void>;
  onCancel: () => void;
};

export const ShareDocumentDialog = ({
  isOpen,
  shareId,
  onShare,
  onStopSharing,
  onCancel,
}: ShareDocumentDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const copyLink = useCallback(async (id: ShareId) => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Creating the share ID is the moment the user wants it, so copy it right away
  // rather than asking for a second click.
  const handleCreateLink = useCallback(async () => {
    setSharing(true);
    try {
      const url = await onShare();
      if (url) await copyLink(url);
    } finally {
      setSharing(false);
    }
  }, [onShare, copyLink]);

  const handleCopyLink = useCallback(async () => {
    if (shareId) await copyLink(shareId);
  }, [shareId, copyLink]);

  const handleStopSharing = useCallback(async () => {
    await onStopSharing();
    onCancel();
  }, [onStopSharing, onCancel]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeButton={shareId !== null}
      title="Share document"
      secondaryButton={
        shareId ? (
          <Button variant="plain" onClick={handleStopSharing}>
            Stop sharing
          </Button>
        ) : (
          <Button variant="plain" onClick={onCancel}>
            Cancel
          </Button>
        )
      }
      primaryButton={
        shareId ? (
          <Button color="purple" onClick={handleCopyLink}>
            {copied ? (
              <CheckIcon className="mr-1" />
            ) : (
              <CopyIcon className="mr-1" />
            )}
            {copied ? 'Copied' : 'Copy share ID'}
          </Button>
        ) : (
          <Button color="purple" onClick={handleCreateLink} disabled={sharing}>
            Create share ID
          </Button>
        )
      }
    >
      {shareId ? (
        <div className="space-y-4">
          <p>Anyone with this share ID can edit this document with you.</p>
          <p
            className="cursor-text select-all truncate rounded border border-zinc-950/10 bg-zinc-950/[2.5%] px-3 py-2 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            title={shareId}
            data-testid="share-id"
          >
            {shareId}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Stop sharing disconnects you. Others keep the shared version.
          </p>
        </div>
      ) : (
        <p>
          Create a share ID to edit this document with others. Each person keeps
          their own copy of the project.
        </p>
      )}
    </Modal>
  );
};
