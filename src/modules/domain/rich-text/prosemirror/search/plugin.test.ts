import { para } from '../test-utils';
import { searchPlugin } from './plugin';
import { getSearchMatches, getSearchQueryText } from './state';
import { stateWithQuery } from './test-utils';

describe('searchPlugin', () => {
  // prosemirror-search keys its plugin with a module-level PluginKey, so a
  // plugin rebuild (`reconfigure` with a fresh `searchPlugin()`) keeps the
  // active query. The find bar relies on this to stay in sync across rebuilds.
  it('keeps the query when the state is reconfigured with a fresh plugin', () => {
    const state = stateWithQuery([para('hello')], 'hello');
    const reconfigured = state.reconfigure({ plugins: [searchPlugin()] });
    expect(getSearchQueryText(reconfigured)).toBe('hello');
    expect(getSearchMatches(reconfigured)).toHaveLength(1);
  });
});
