import { useMemo } from 'react';
import { useParams } from 'react-router';

import {
  type ChangeId,
  decodeUrlEncodedChangeId,
} from '../../../../../modules/infrastructure/version-control';

export const useCurrentChangeId = (): ChangeId | null => {
  const { changeId: urlEncodedChangeId } = useParams();

  return useMemo(
    () =>
      urlEncodedChangeId ? decodeUrlEncodedChangeId(urlEncodedChangeId) : null,
    [urlEncodedChangeId]
  );
};
