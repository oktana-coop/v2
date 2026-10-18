import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { protocol } from 'electron';

import {
  type AssetUrlProtocol,
  createElectronAssetProtocolAdapter,
  PROJECT_ASSET_SCHEME,
  type ProjectId,
  type ProjectRelPath,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectValidationErrorTag,
} from '../modules/domain/project/node';
import { getProjectStore } from './project-stores';

export const createAssetUrlProtocol = (): AssetUrlProtocol => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROJECT_ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
  return createElectronAssetProtocolAdapter();
};

const readAssetBytes = (args: {
  projectId: ProjectId;
  relPath: ProjectRelPath;
}) =>
  pipe(
    getProjectStore(args.projectId),
    Effect.flatMap((projectStore) => projectStore.readAssetBytes(args))
  );

const statusForError = (tag: string): number => {
  if (tag === VersionedProjectValidationErrorTag) return 400;
  if (tag === VersionedProjectNotFoundErrorTag) return 404;
  return 500;
};

export const installProjectAssetProtocolHandler = ({
  assetUrlProtocol,
}: {
  assetUrlProtocol: AssetUrlProtocol;
}) => {
  protocol.handle(PROJECT_ASSET_SCHEME, async (req) =>
    Effect.runPromise(
      pipe(
        assetUrlProtocol.parseProjectAssetUrl(req.url),
        Effect.flatMap(readAssetBytes),
        Effect.match({
          onSuccess: (bytes) => new Response(bytes as BodyInit),
          onFailure: (error) =>
            new Response(null, { status: statusForError(error._tag) }),
        })
      )
    )
  );
};
