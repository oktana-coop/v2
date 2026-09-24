import { createContext, useCallback, useState } from 'react';

import { type Notification } from '../notification';
import { NotificationType } from '../notification-types';

export type DispatchNotificationArgs = {
  type: NotificationType;
  title: string;
  message: string;
};

export type NotificationsContextType = {
  notifications: Record<string, Notification>;
  dispatchNotification: (notification: Notification) => void;
  dismissNotification: (id: string) => void;
};

export const NotificationsContext = createContext<NotificationsContextType>({
  notifications: {},
  dispatchNotification: () => {},
  dismissNotification: () => {},
});

export const NotificationsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [notifications, setNotifications] = useState<
    Record<string, Notification>
  >({});

  // Stable, so effects that depend on them do not re-run per notification.
  const handleDispatchNotification = useCallback(
    (notification: Notification) => {
      setNotifications((prev) => ({
        ...prev,
        [notification.id]: notification,
      }));
    },
    []
  );

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        dispatchNotification: handleDispatchNotification,
        dismissNotification: handleDismissNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
