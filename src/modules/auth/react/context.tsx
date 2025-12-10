import { createContext, useState } from 'react';

import { type Email, type Username } from '../models';

type AuthContextType = {
  username: Username | null;
  email: Email | null;
  setUsername: (name: Username | null) => void;
  setEmail: (email: Email | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  username: null,
  email: null,
  setUsername: () => {},
  setEmail: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [username, setUsername] = useState<Username | null>(null);
  const [email, setEmail] = useState<Email | null>(null);

  const handleSetUsername = (name: Username | null) => {
    setUsername(name);
  };

  const handleSetEmail = (mail: Email | null) => {
    setEmail(mail);
  };

  return (
    <AuthContext.Provider
      value={{
        username,
        email,
        setUsername: handleSetUsername,
        setEmail: handleSetEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
