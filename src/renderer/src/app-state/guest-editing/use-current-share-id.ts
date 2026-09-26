import { useMemo } from 'react';
import { useParams } from 'react-router';

import {
  decodeUrlEncodedShareId,
  type ShareId,
} from '../../../../modules/domain/project';

export const useCurrentShareId = (): ShareId | null => {
  const { shareId } = useParams();

  return useMemo(
    () => (shareId ? decodeUrlEncodedShareId(shareId) : null),
    [shareId]
  );
};
