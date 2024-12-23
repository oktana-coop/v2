import React, { useState } from 'react';

import { isValidURL, LinkAttrs } from '../../../../modules/rich-text';
import { Button } from '../actions/Button';
import { Modal } from '../dialogs/Modal';
import { CheckIcon } from '../icons/Check';
import {
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label,
} from '../inputs/Fieldset';
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
  const [invalidURL, setInvalidURL] = useState<boolean>(false);
  const [hasClickedSave, setHasClickedSave] = useState<boolean>(false);

  // TODO: Validate links before saving
  const handleSave = () => {
    if (title && isValidURL(href)) {
      onSave({ title, href });
    }

    setHasClickedSave(true);
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

    if (isValidURL(href)) {
      setInvalidURL(false);
    } else {
      setInvalidURL(true);
    }
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
        <Button
          onClick={handleSave}
          disabled={!(title && href && !invalidURL)}
          color="purple"
        >
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
            {hasClickedSave && invalidURL && (
              <ErrorMessage>Invalid Link</ErrorMessage>
            )}
          </Field>
        </FieldGroup>
      </Fieldset>
    </Modal>
  );
};
