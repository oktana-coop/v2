import { type ReactNode } from 'react';

import { getDocumentContentErrorMessage } from '../../../../../../modules/domain/rich-text/react/document-content-errors';
import { ErrorMessage } from '../../../inputs/Fieldset';
import { type MetadataEditFailure } from './field-props';

const FieldError = ({ children }: { children: ReactNode }) => (
  <ErrorMessage className="mt-1">{children}</ErrorMessage>
);

// For a value cleared, or a list's last item removed.
export const ClearedMessage = () => (
  <FieldError>Use Remove to delete the property</FieldError>
);

export const FailureMessage = ({
  failure,
}: {
  failure: MetadataEditFailure;
}) => (
  <FieldError>
    {getDocumentContentErrorMessage(failure.error) ??
      "The property can't be saved."}
  </FieldError>
);

export const TextFieldErrors = ({
  isCleared,
  failure,
}: {
  isCleared: boolean;
  failure: MetadataEditFailure | undefined;
}) => {
  if (isCleared) {
    return <ClearedMessage />;
  }

  return failure ? <FailureMessage failure={failure} /> : null;
};
