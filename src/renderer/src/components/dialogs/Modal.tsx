import { IconButton } from '../actions/IconButton';
import { CloseIcon } from '../icons';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from './Dialog';

type ModalProps = {
  title: string;
  description?: string;
  isOpen?: boolean;
  onClose?: () => void;
  // Shows an X in the title row, for dialogs without a dismiss button.
  closeButton?: boolean;
  primaryButton?: React.ReactNode;
  secondaryButton?: React.ReactNode;
  children?: React.ReactNode;
};

export const Modal = ({
  title,
  description,
  isOpen = false,
  onClose,
  closeButton = false,
  primaryButton,
  secondaryButton,
  children,
}: ModalProps) => {
  const handleClose = () => onClose?.();

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <div className="flex items-start justify-between gap-4">
        <DialogTitle>{title}</DialogTitle>
        {closeButton && (
          <IconButton
            icon={<CloseIcon />}
            onClick={handleClose}
            tooltip="Close"
          />
        )}
      </div>
      {description && <DialogDescription>{description}</DialogDescription>}
      {children && <DialogBody>{children}</DialogBody>}
      <DialogActions>
        {secondaryButton}
        {primaryButton}
      </DialogActions>
    </Dialog>
  );
};
