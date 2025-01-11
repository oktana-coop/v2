import { useEffect, useState } from 'react';

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
  primaryButton?: React.ReactNode;
  secondaryButton?: React.ReactNode;
  children?: React.ReactNode;
};

export const Modal = ({
  title,
  description,
  isOpen: isOpenProp = false,
  onClose,
  primaryButton,
  secondaryButton,
  children,
}: ModalProps) => {
  const [isOpen, setIsOpen] = useState(isOpenProp);

  useEffect(() => {
    setIsOpen(isOpenProp);
  }, [isOpenProp]);

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
      {children && <DialogBody>{children}</DialogBody>}
      <DialogActions>
        {secondaryButton}
        {primaryButton}
      </DialogActions>
    </Dialog>
  );
};
