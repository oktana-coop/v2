import React, { useEffect, useState } from 'react';

import {
  ensureHttpPrefix,
  LinkAttrs,
} from '../../../../modules/domain/rich-text';
import { Button } from '../actions/Button';
import { Modal } from '../dialogs/Modal';
import { CheckIcon } from '../icons/Check';
import { Field, FieldGroup, Fieldset, Label } from '../inputs/Fieldset';
import { Input } from '../inputs/Input';

type LinkDialogProps = {
  initialLinkAttrs: LinkAttrs;
  isOpen?: boolean;
  onCancel?: () => void;
  onSave: (attrs: LinkAttrs) => void;
};

export const LinkDialog = ({
  initialLinkAttrs,
  isOpen = false,
  onCancel,
  onSave,
}: LinkDialogProps) => {
  const [title, setTitle] = useState<string>(initialLinkAttrs.title);
  const [href, setHref] = useState<string>(initialLinkAttrs.href);

  useEffect(() => {
    setTitle(initialLinkAttrs.title);
    setHref(initialLinkAttrs.href);
  }, [initialLinkAttrs]);

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

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
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
              value={title}
              name="title"
              onChange={handleTitleChange}
              onKeyDown={handleKeyDown}
            />
          </Field>
          <Field>
            <Label>Link</Label>
            <Input
              name="href"
              value={href}
              onChange={handleHrefChange}
              onKeyDown={handleKeyDown}
            />
          </Field>
        </FieldGroup>
      </Fieldset>
    </Modal>
  );
};
