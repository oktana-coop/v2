import { AutomergeUrl } from '@automerge/automerge-repo';
import { useHandle as useHandleAutomerge } from '@automerge/automerge-repo-react-hooks';
import { useEffect, useState } from 'react';

import { VersionedDocument } from '..';

export function useHandle(docUrl: AutomergeUrl) {
  const handle = useHandleAutomerge<VersionedDocument>(docUrl);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (handle && !isReady) {
      handle.whenReady().then(() => {
        setIsReady(true);
      });
    }
  }, [handle]);

  return { handle, isReady };
}
