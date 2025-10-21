import { type WorkerClient } from '../../../../../utils/web-worker/types';
import { type VersionControlId } from '../../../../infrastructure/version-control';
import { type HistoryInfo } from './types';

export const createVersionControlWorkerAPI = (client: WorkerClient) => {
  return {
    loadHistory: (id: VersionControlId) =>
      client.send<{ documentId: VersionControlId }, HistoryInfo>(
        'loadHistory',
        {
          documentId: id,
        }
      ),
  };
};
