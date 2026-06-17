import * as Effect from 'effect/Effect';

import { type AssetUrlProtocol } from '../../../ports/asset-url-protocol';
import {
  buildProjectAssetUrl,
  parseProjectAssetUrl,
  PROJECT_ASSET_SCHEME,
} from './url';

export { PROJECT_ASSET_SCHEME };

export const createAdapter = (): AssetUrlProtocol => ({
  buildProjectAssetUrl: (args) => Effect.sync(() => buildProjectAssetUrl(args)),
  parseProjectAssetUrl,
});
