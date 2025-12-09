import type { ValueOf } from 'type-fest';

const INFO_NOTIFICATION = 'INFO_NOTIFICATION';
const ERROR_NOTIFICATION = 'ERROR_NOTIFICATION';

export const notificationTypes = {
  INFO_NOTIFICATION,
  ERROR_NOTIFICATION,
} as const;

export type NotificationType = ValueOf<typeof notificationTypes>;
