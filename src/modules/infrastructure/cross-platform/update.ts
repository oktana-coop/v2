export type CheckingForUpdateState = {
  status: 'checking-for-update';
};

export type UpdateAvailableState = {
  status: 'update-available';
  version: string;
  newVersion: string;
};

export type UpdateNotAvailableState = {
  status: 'update-not-available';
  version: string;
};

export type DownloadingUpdateState = {
  status: 'downloading-update';
  progress: number; // Progress percentage (0-100)
};

export type UpdateDownloadedState = {
  status: 'update-downloaded';
};

export type UpdateErrorState = {
  status: 'update-error';
  message: string;
};

export type UpdateState =
  | CheckingForUpdateState
  | UpdateAvailableState
  | UpdateNotAvailableState
  | DownloadingUpdateState
  | UpdateDownloadedState
  | UpdateErrorState;

export const isCheckingForUpdateState = (
  state: UpdateState
): state is CheckingForUpdateState => state.status === 'checking-for-update';

export const isUpdateAvailableState = (
  state: UpdateState
): state is UpdateAvailableState => state.status === 'update-available';

export const isUpdateNotAvailableState = (
  state: UpdateState
): state is UpdateNotAvailableState => state.status === 'update-not-available';

export const isDownloadingUpdateState = (
  state: UpdateState
): state is DownloadingUpdateState => state.status === 'downloading-update';

export const isUpdateDownloadedState = (
  state: UpdateState
): state is UpdateDownloadedState => state.status === 'update-downloaded';

export const isUpdateErrorState = (
  state: UpdateState
): state is UpdateErrorState => state.status === 'update-error';
