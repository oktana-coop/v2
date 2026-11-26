import { type ReactNode } from 'react';

import { InvalidMetadataKeyError } from '../../../../../../modules/domain/rich-text';
import { getDocumentContentErrorMessage } from '../../../../../../modules/domain/rich-text/react/document-content-errors';
import { ErrorMessage } from '../../../inputs/Fieldset';
import { type MetadataEditFailure } from './field-props';
import { clearedMessage, invalidKeyMessage } from './validation';

const FieldError = ({ children }: { children: ReactNode }) => (
  <ErrorMessage className="mt-1">{children}</ErrorMessage>
);

// For a value cleared, or a list's last item removed.
export const ClearedMessage = () => <FieldError>{clearedMessage}</FieldError>;

const failureMessage = (failure: MetadataEditFailure): string => {
  if (failure.error instanceof InvalidMetadataKeyError) {
    return invalidKeyMessage(failure.error.data.reason);
  }

  return (
    getDocumentContentErrorMessage(failure.error) ??
    "The property can't be saved."
  );
};

export const FailureMessage = ({
  failure,
}: {
  failure: MetadataEditFailure;
}) => <FieldError>{failureMessage(failure)}</FieldError>;

export const TextFieldErrors = ({
  validationError,
  failure,
}: {
  validationError: string | null;
  failure: MetadataEditFailure | undefined;
}) => {
  if (validationError !== null) {
    return <FieldError>{validationError}</FieldError>;
  }

  return failure ? <FailureMessage failure={failure} /> : null;
};
