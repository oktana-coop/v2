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
  primaryButton?: React.ReactNode;
  secondaryButton?: React.ReactNode;
  children?: React.ReactNode;
};

export const Modal = ({
  title,
  description,
  isOpen: isOpenProp = false,
  primaryButton,
  secondaryButton,
  children,
}: ModalProps) => {
  const [isOpen, setIsOpen] = useState(isOpenProp);
  useEffect(() => {
    setIsOpen(isOpenProp);
  }, [isOpenProp]);

  return (
    <Dialog open={isOpen} onClose={() => {}}>
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
