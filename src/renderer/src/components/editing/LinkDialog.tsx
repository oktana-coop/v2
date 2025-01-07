import React, { useState } from 'react';

import { ensureHttpPrefix, LinkAttrs } from '../../../../modules/rich-text';
import { Button } from '../actions/Button';
import { Modal } from '../dialogs/Modal';
import { CheckIcon } from '../icons/Check';
import { Field, FieldGroup, Fieldset, Label } from '../inputs/Fieldset';
import { Input } from '../inputs/Input';

type LinkDialogProps = {
  onSave: (attrs: LinkAttrs) => void;
  onCancel?: () => void;
  isOpen?: boolean;
};

export const LinkDialog = ({
  isOpen = false,
  onCancel,
  onSave,
}: LinkDialogProps) => {
  const [title, setTitle] = useState<string>('');
  const [href, setHref] = useState<string>('');

  const handleSave = () => {
    if (title && href) {
      onSave({ title, href: ensureHttpPrefix(href) });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // on Escape key press
    if (onCancel && e.key === 'Escape') {
      onCancel();
    }

    // on cmd/ctrl + enter --> save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleHrefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHref(e.target.value);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Link Details"
      secondaryButton={
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      }
      primaryButton={
        <Button onClick={handleSave} disabled={!(title && href)} color="purple">
          <CheckIcon />
          Save
        </Button>
      }
    >
      <Fieldset>
        <FieldGroup>
          <Field>
            <Label>Text</Label>
            <Input
              autoFocus={true}
              name="title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </Field>
          <Field>
            <Label>Link</Label>
            <Input
              name="href"
              onChange={handleHrefChange}
              onKeyDown={handleKeyDown}
            />
          </Field>
        </FieldGroup>
      </Fieldset>
    </Modal>
  );
};
