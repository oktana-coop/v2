import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ElectronContext } from '../../infrastructure/cross-platform/electron-context';
import {
  type Email,
  parseEmail,
  parseUsername,
  type Username,
} from '../models';

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

const getAuthInfoFromLocalStorage = () => {
  const localStorageUsername = localStorage.getItem('username');
  const username = localStorageUsername
    ? parseUsername(localStorageUsername)
    : null;

  const localStorageEmail = localStorage.getItem('email');
  const email = localStorageEmail ? parseEmail(localStorageEmail) : null;

  return {
    username,
    email,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { isElectron } = useContext(ElectronContext);
  const [username, setUsername] = useState<Username | null>(null);
  const [email, setEmail] = useState<Email | null>(null);

  const handleSetUsername = useCallback(
    (name: Username | null) => {
      setUsername(name);

      if (isElectron) {
        window.authAPI.setUsername(name);
      } else {
        localStorage.setItem('username', name ?? '');
      }
    },
    [isElectron]
  );

  const handleSetEmail = useCallback(
    (mail: Email | null) => {
      setEmail(mail);

      if (isElectron) {
        window.authAPI.setEmail(mail);
      } else {
        localStorage.setItem('email', mail ?? '');
      }
    },
    [isElectron]
  );

  useEffect(() => {
    const readAuthInfoFromMain = async () => {
      const { username, email } = await window.authAPI.getInfo();
      setUsername(username);
      setEmail(email);
    };

    const readAuthInfoFromLocalStorage = async () => {
      const { username, email } = await getAuthInfoFromLocalStorage();
      setUsername(username);
      setEmail(email);
    };

    if (isElectron) {
      readAuthInfoFromMain();
    } else {
      readAuthInfoFromLocalStorage();
    }
  }, [isElectron]);

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
