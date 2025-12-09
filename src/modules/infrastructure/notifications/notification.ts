import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { notificationTypes } from './notification-types';

const notificationInfoSchema = z.object({
  id: z.uuidv4(),
  title: z.string().min(1).max(64),
  message: z.string().min(1).max(255),
});

type NotificationInfo = z.infer<typeof notificationInfoSchema>;

const infoNotificationSchema = notificationInfoSchema
  .extend({
    type: z.literal(notificationTypes.INFO_NOTIFICATION),
  })
  .brand('InfoNotification');

export type InfoNotification = z.infer<typeof infoNotificationSchema>;

const errorNotificationSchema = notificationInfoSchema
  .extend({
    type: z.literal(notificationTypes.ERROR_NOTIFICATION),
  })
  .brand('ErrorNotification');

export type ErrorNotification = z.infer<typeof errorNotificationSchema>;

export const notificationSchema = z.union([
  infoNotificationSchema,
  errorNotificationSchema,
]);

export type Notification = z.infer<typeof notificationSchema>;

export const createInfoNotification = ({
  title,
  message,
}: {
  title: NotificationInfo['title'];
  message: NotificationInfo['message'];
}) =>
  notificationSchema.parse({
    id: uuidv4(),
    type: notificationTypes.INFO_NOTIFICATION,
    title,
    message,
  });

export const createErrorNotification = ({
  title,
  message,
}: {
  title: NotificationInfo['title'];
  message: NotificationInfo['message'];
}) =>
  notificationSchema.parse({
    id: uuidv4(),
    type: notificationTypes.ERROR_NOTIFICATION,
    title,
    message,
  });

export const isInfoNotification = (
  notification: Notification
): notification is InfoNotification =>
  notification.type === notificationTypes.INFO_NOTIFICATION;

export const isErrorNotification = (
  notification: Notification
): notification is ErrorNotification =>
  notification.type === notificationTypes.ERROR_NOTIFICATION;
