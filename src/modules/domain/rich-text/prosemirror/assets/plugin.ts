import { Plugin, PluginKey } from 'prosemirror-state';

import { type ResolveAssetSrc } from './ImageView';

type AssetsPluginState = {
  resolveAssetSrc: ResolveAssetSrc;
};

export const assetsPluginKey = new PluginKey<AssetsPluginState>('assets');

// Carries the current document's asset resolver in the editor state, so node
// views always resolve against the document they belong to.
export const assetsPlugin = (
  resolveAssetSrc: ResolveAssetSrc
): Plugin<AssetsPluginState> =>
  new Plugin({
    key: assetsPluginKey,
    state: {
      init: () => ({ resolveAssetSrc }),
      apply: (_tr, pluginState) => pluginState,
    },
  });
