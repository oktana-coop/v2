import { type Schema } from 'prosemirror-model';
import { useEffect, useState } from 'react';

import { prosemirror } from '../../../../modules/domain/rich-text';
import { type EditorSeed } from './ProseMirrorEditor';

const { schema } = prosemirror;

export const useEditorSeed = <Seed extends EditorSeed>(
  createSeed: (schema: Schema) => Promise<Seed>
): Seed | null => {
  const [seed, setSeed] = useState<Seed | null>(null);

  useEffect(() => {
    let cancelled = false;

    const createAndSetSeed = async () => {
      const created = await createSeed(schema);
      if (cancelled) return;
      setSeed(created);
    };

    createAndSetSeed();

    return () => {
      cancelled = true;
    };
  }, [createSeed]);

  return seed;
};
