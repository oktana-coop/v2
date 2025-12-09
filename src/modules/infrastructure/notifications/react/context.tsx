import { createContext, useState } from 'react';

import {
  createErrorNotification,
  createInfoNotification,
  type Notification,
} from '../notification';
import { NotificationType, notificationTypes } from '../notification-types';

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

  const handleDispatchNotification = (notification: Notification) => {
    setNotifications((prev) => ({
      ...prev,
      [notification.id]: notification,
    }));
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

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
