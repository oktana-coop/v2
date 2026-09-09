import { useCallback, useState } from 'react';

import { type ShareUrl } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon, CopyIcon } from '../../../../components/icons';

export type ShareDocumentDialogProps = {
  isOpen?: boolean;
  shareUrl: ShareUrl | null;
  // Resolves to the new share url, or null when sharing did not happen.
  onShare: () => Promise<ShareUrl | null>;
  onStopSharing: () => Promise<void>;
  onCancel: () => void;
};

export const ShareDocumentDialog = ({
  isOpen,
  shareUrl,
  onShare,
  onStopSharing,
  onCancel,
}: ShareDocumentDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const copyLink = useCallback(async (url: ShareUrl) => {
    await navigator.clipboard.writeText(url);
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
    if (shareUrl) await copyLink(shareUrl);
  }, [shareUrl, copyLink]);

  const handleStopSharing = useCallback(async () => {
    await onStopSharing();
    onCancel();
  }, [onStopSharing, onCancel]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeButton={shareUrl !== null}
      title="Share document"
      secondaryButton={
        shareUrl ? (
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
        shareUrl ? (
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
      {shareUrl ? (
        <div className="space-y-4">
          <p>Anyone with this share ID can edit this document with you.</p>
          <p
            className="cursor-text select-all truncate rounded border border-zinc-950/10 bg-zinc-950/[2.5%] px-3 py-2 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            title={shareUrl}
            data-testid="share-id"
          >
            {shareUrl}
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
