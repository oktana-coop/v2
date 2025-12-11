import { useContext, useEffect, useState } from 'react';

import {
  AuthContext,
  parseEmail,
  parseUsername,
} from '../../../../modules/auth/browser';
import { UserIcon } from '../../components/icons';
import {
  ErrorMessage,
  Field,
  FieldGroup,
  Label,
} from '../../components/inputs/Fieldset';
import { Input } from '../../components/inputs/Input';
import { SectionHeader } from './SectionHeader';

export const AuthorInfoSection = () => {
  const {
    username,
    email,
    setUsername: updateUsername,
    setEmail: updateEmail,
  } = useContext(AuthContext);

  const [usernameInputValue, setUsernameInputValue] = useState<string>('');
  const [emailInputValue, setEmailInputValue] = useState<string>('');
  const [invalidUsernameMessage, setInvalidUsernameMessage] =
    useState<string>('');
  const [invalidEmailMessage, setInvalidEmailMessage] = useState<string>('');

  useEffect(() => {
    if (username) {
      setUsernameInputValue(username);
    }
  }, [username]);

  useEffect(() => {
    if (email) {
      setEmailInputValue(email);
    }
  }, [email]);

  const validateAndUpdateUsername = (input: string) => {
    try {
      if (input === '') {
        updateUsername(null);
      } else {
        const username = parseUsername(input);
        updateUsername(username);
      }
      setInvalidUsernameMessage('');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      setInvalidUsernameMessage('Invalid username');
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameInputValue(e.target.value);
    validateAndUpdateUsername(e.target.value);
  };

  const validateAndUpdateEmail = (input: string) => {
    try {
      if (input === '') {
        updateEmail(null);
      } else {
        const email = parseEmail(input);
        updateEmail(email);
      }

      setInvalidEmailMessage('');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      setInvalidEmailMessage('Invalid email');
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInputValue(e.target.value);
    validateAndUpdateEmail(e.target.value);
  };

  return (
    <div className="text-left">
      <SectionHeader icon={UserIcon} heading="Author Info" />
      <p className="mb-6">This info is associated with your commits</p>
      <FieldGroup className="!space-y-4">
        <Field>
          <Label>Name</Label>
          <Input
            autoFocus={true}
            value={usernameInputValue}
            name="Name"
            onChange={handleUsernameChange}
            invalid={Boolean(invalidUsernameMessage)}
          />
          {invalidUsernameMessage && (
            <ErrorMessage>{invalidUsernameMessage}</ErrorMessage>
          )}
        </Field>
        <Field>
          <Label>Email</Label>
          <Input
            name="Email"
            type="email"
            value={emailInputValue}
            onChange={handleEmailChange}
            invalid={Boolean(invalidEmailMessage)}
          />
          {invalidEmailMessage && (
            <ErrorMessage>{invalidEmailMessage}</ErrorMessage>
          )}
        </Field>
      </FieldGroup>
    </div>
  );
};
