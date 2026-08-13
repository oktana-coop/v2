import { useCallback, useState } from 'react';

import { type ShareUrl } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { Input } from '../../../../components/inputs/Input';

export type JoinSharedDocumentDialogProps = {
  isOpen?: boolean;
  onJoin: (shareUrl: ShareUrl) => Promise<void>;
  onCancel: () => void;
};

export const JoinSharedDocumentDialog = ({
  isOpen,
  onJoin,
  onCancel,
}: JoinSharedDocumentDialogProps) => {
  const [link, setLink] = useState('');

  const handleJoin = useCallback(async () => {
    const shareUrl = link.trim();

    if (!shareUrl) return;

    await onJoin(shareUrl);
    setLink('');
  }, [link, onJoin]);

  const handleCancel = useCallback(() => {
    setLink('');
    onCancel();
  }, [onCancel]);

  return (
    <Modal
      isOpen={isOpen}
      title="Join Shared Document"
      secondaryButton={
        <Button variant="plain" onClick={handleCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button onClick={handleJoin} disabled={!link.trim()}>
          Join
        </Button>
      }
    >
      <div className="space-y-3">
        <p>
          Paste the link you were sent. It joins the document you have open, so
          make sure that is the one the link is for.
        </p>
        <Input
          type="text"
          value={link}
          autoFocus
          placeholder="Shared document link"
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleJoin();
          }}
        />
      </div>
    </Modal>
  );
};
