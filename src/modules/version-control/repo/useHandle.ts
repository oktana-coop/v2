import { AutomergeUrl } from '@automerge/automerge-repo';
import { useHandle as useHandleAutomerge } from '@automerge/automerge-repo-react-hooks';
import { useEffect, useState } from 'react';

import { VersionedDocument } from '../models/document';

export function useHandle(docUrl: AutomergeUrl) {
  const handle = useHandleAutomerge<VersionedDocument>(docUrl);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (handle && !isReady) {
      handle.whenReady().then(() => {
        setIsReady(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return { handle, isReady };
}
