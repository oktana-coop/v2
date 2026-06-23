import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  createErrorNotification,
  NotificationsContext,
} from '../../infrastructure/notifications/browser';
import {
  type Email,
  type GithubDeviceFlowVerificationInfo,
  type GithubUserInfo,
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
  cancelConnectingToGithub: () => Promise<void>;
  disconnectFromGithub: () => Promise<void>;
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
  disconnectFromGithub: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
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

  const handleSetUsername = useCallback((name: Username | null) => {
    setUsername(name);
    window.authAPI.setUsername(name);
  }, []);

  const handleSetEmail = useCallback((mail: Email | null) => {
    setEmail(mail);
    window.authAPI.setEmail(mail);
  }, []);

  useEffect(() => {
    const readAuthInfoFromMain = async () => {
      const { username, email, githubUserInfo } =
        await window.authAPI.getInfo();
      setUsername(username);
      setEmail(email);
      setGithubUserInfo(githubUserInfo);
    };

    const unsubscribeFromGithubVerificationInfoAvailability =
      window.authAPI.onDeviceVerificationInfoAvailable((verificationInfo) => {
        setGithubDeviceFlowVerificationInfo(verificationInfo);
      });

    readAuthInfoFromMain();

    return () => {
      unsubscribeFromGithubVerificationInfoAvailability?.();
      setGithubDeviceFlowVerificationInfo(null);
    };
  }, []);

  const handleConnectToGithub = useCallback(async () => {
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
  }, [dispatchNotification]);

  const handleCancelConnectingToGithub = useCallback(async () => {
    await window.authAPI.cancelGithubDeviceFlowAuth();
    setGithubDeviceFlowVerificationInfo(null);
  }, []);

  const handleDisconnectFromGithub = useCallback(async () => {
    await window.authAPI.disconnectFromGithub();
    setGithubUserInfo(null);
    setGithubDeviceFlowVerificationInfo(null);
  }, []);

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
        cancelConnectingToGithub: handleCancelConnectingToGithub,
        disconnectFromGithub: handleDisconnectFromGithub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
