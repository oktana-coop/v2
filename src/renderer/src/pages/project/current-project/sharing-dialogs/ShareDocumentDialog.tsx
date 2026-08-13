import { type MouseEventHandler, useCallback, useState } from 'react';

import { type ShareUrl } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon, CopyIcon } from '../../../../components/icons';

export type ShareDocumentDialogProps = {
  isOpen?: boolean;
  shareUrl: ShareUrl | null;
  onShare: () => Promise<void>;
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

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      await onShare();
    } finally {
      setSharing(false);
    }
  }, [onShare]);

  const handleCopyLink: MouseEventHandler<HTMLButtonElement> =
    useCallback(async () => {
      if (!shareUrl) return;

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [shareUrl]);

  const handleStopSharing = useCallback(async () => {
    await onStopSharing();
    onCancel();
  }, [onStopSharing, onCancel]);

  return (
    <Modal
      isOpen={isOpen}
      title="Share Document"
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
          <Button onClick={onCancel}>Done</Button>
        ) : (
          <Button onClick={handleShare} disabled={sharing}>
            Share document
          </Button>
        )
      }
    >
      {shareUrl ? (
        <div className="space-y-3">
          <p>
            Anyone with this link can edit this document with you, as long as
            they have the same document open.
          </p>
          <Button className="w-full" variant="outline" onClick={handleCopyLink}>
            {copied ? (
              <CheckIcon className="mr-1 text-green-500 dark:text-green-400" />
            ) : (
              <CopyIcon className="mr-1" />
            )}
            <span className="truncate">{shareUrl}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-semibold">Edit this document with others</p>
          <p>
            Sharing gives you a link to send to whoever you write with. Everyone
            keeps their own copy of the project, and edits are saved as usual.
          </p>
        </div>
      )}
    </Modal>
  );
};
