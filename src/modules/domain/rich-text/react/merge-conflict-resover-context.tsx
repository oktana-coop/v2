import { createContext, useContext, useEffect, useState } from 'react';

import { createAdapter as createAutomergeConflictResolverAdapter } from '../adapters/automerge-conflict-resolver';
import { type MergeConflictResolver } from '../ports';
import { RepresentationTransformContext } from './representation-transform-context';

type MergeConflictResolverContextType = {
  adapter: MergeConflictResolver | null;
};

export const MergeConflictResolverContext =
  createContext<MergeConflictResolverContextType>({
    adapter: null,
  });

export const MergeConflictResolverProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const [adapter, setAdapter] = useState<MergeConflictResolver | null>(null);

  useEffect(() => {
    if (representationTransformAdapter) {
      const automergePandocAdapter = createAutomergeConflictResolverAdapter({
        transformToText: representationTransformAdapter.transformToText,
      });

      setAdapter(automergePandocAdapter);
    } else {
      setAdapter(null);
    }
  }, [representationTransformAdapter]);

  return (
    <MergeConflictResolverContext.Provider
      value={{
        adapter,
      }}
    >
      {children}
    </MergeConflictResolverContext.Provider>
  );
};
