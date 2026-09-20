import { useCallback, useState } from 'react';

import { type ShareId } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { Input } from '../../../../components/inputs/Input';

export type JoinSharedDocumentDialogProps = {
  isOpen?: boolean;
  onJoin: (shareId: ShareId) => Promise<void>;
  onCancel: () => void;
};

export const JoinSharedDocumentDialog = ({
  isOpen,
  onJoin,
  onCancel,
}: JoinSharedDocumentDialogProps) => {
  const [link, setLink] = useState('');

  const handleJoin = useCallback(async () => {
    const shareId = link.trim();

    if (!shareId) return;

    await onJoin(shareId);
    setLink('');
  }, [link, onJoin]);

  const handleCancel = useCallback(() => {
    setLink('');
    onCancel();
  }, [onCancel]);

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
        <p>
          Paste the share ID you were sent. It opens the shared document in this
          project.
        </p>
        <Input
          type="text"
          value={link}
          autoFocus
          placeholder="Share ID"
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleJoin();
          }}
        />
      </div>
    </Modal>
  );
};
