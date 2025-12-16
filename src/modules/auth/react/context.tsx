import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ElectronContext } from '../../infrastructure/cross-platform/electron-context';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../infrastructure/notifications/browser';
import {
  type Email,
  type GithubDeviceFlowVerificationInfo,
  type GithubUserInfo,
  parseEmail,
  parseUsername,
  type Username,
} from '../models';

type AuthContextType = {
  username: Username | null;
  email: Email | null;
  githubUserInfo: GithubUserInfo | null;
  githubDeviceFlowVerificationInfo: GithubDeviceFlowVerificationInfo | null;
  setUsername: (name: Username | null) => void;
  setEmail: (email: Email | null) => void;
  connectToGithub: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  username: null,
  email: null,
  githubUserInfo: null,
  githubDeviceFlowVerificationInfo: null,
  setUsername: () => {},
  setEmail: () => {},
  // @ts-expect-error will get overriden below
  connectToGithub: async () => null,
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
  const { dispatchNotification } = useContext(NotificationsContext);
  const [username, setUsername] = useState<Username | null>(null);
  const [email, setEmail] = useState<Email | null>(null);
  const [githubUserInfo, setGithubUserInfo] = useState<GithubUserInfo | null>(
    null
  );
  const [
    githubDeviceFlowVerificationInfo,
    setGithubDeviceFlowVerificationInfo,
  ] = useState<GithubDeviceFlowVerificationInfo | null>(null);

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
      const { username, email, githubUserInfo } =
        await window.authAPI.getInfo();
      setUsername(username);
      setEmail(email);
      setGithubUserInfo(githubUserInfo);
    };

    const readAuthInfoFromLocalStorage = async () => {
      const { username, email } = await getAuthInfoFromLocalStorage();
      setUsername(username);
      setEmail(email);
    };

    const unsubscribeFromGithubVerificationInfoAvailability =
      window.authAPI?.onDeviceVerificationInfoAvailable((verificationInfo) => {
        setGithubDeviceFlowVerificationInfo(verificationInfo);
      });

    if (isElectron) {
      readAuthInfoFromMain();
    } else {
      readAuthInfoFromLocalStorage();
    }

    return () => {
      unsubscribeFromGithubVerificationInfoAvailability?.();
      setGithubDeviceFlowVerificationInfo(null);
    };
  }, [isElectron]);

  const handleConnectToGithub = useCallback(async () => {
    if (isElectron) {
      try {
        const githubUserInfo = await window.authAPI.githubAuthUsingDeviceFlow();
        setGithubUserInfo(githubUserInfo);
        setGithubDeviceFlowVerificationInfo(null);
      } catch (err) {
        console.error(err);

        setGithubUserInfo(null);
        setGithubDeviceFlowVerificationInfo(null);

        const notification = createErrorNotification({
          title: 'Sync Provider Error',
          message: 'An error occured when trying to connect with GitHub',
        });
        dispatchNotification(notification);
      }
    }
  }, [isElectron, dispatchNotification]);

  return (
    <AuthContext.Provider
      value={{
        username,
        email,
        githubUserInfo,
        githubDeviceFlowVerificationInfo,
        setUsername: handleSetUsername,
        setEmail: handleSetEmail,
        connectToGithub: handleConnectToGithub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
