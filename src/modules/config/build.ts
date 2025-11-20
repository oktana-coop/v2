import { BuildConfig } from './types';

export const buildConfig: BuildConfig = {
  useHistoryWorker:
    import.meta.env.VITE_USE_HISTORY_WORKER === 'true' ? true : false,
};
