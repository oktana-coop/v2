import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { useCallback, useContext } from 'react';

import {
  insertAssetInProject,
  parseProjectRelPathEffect,
  projectRelToDocRel,
} from '../../../modules/domain/project';
import { type DocumentAsset } from '../../../modules/domain/rich-text';
import { InfrastructureAdaptersContext, ProjectContext } from '../app-state';

export const useAssetInsertion = (
  docPath?: string
): (() => Promise<DocumentAsset | null>) => {
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const { projectId, projectStore, selectedFileInfo, refreshDirectoryTree } =
    useContext(ProjectContext);

  const docPathString = docPath ?? selectedFileInfo?.path;

  return useCallback(async (): Promise<DocumentAsset | null> => {
    if (!projectId) {
      throw new Error('Cannot insert asset: no current project.');
    }
    if (!docPathString) {
      throw new Error('Cannot insert asset: no doc path.');
    }

    if (!projectStore) {
      throw new Error('Cannot insert asset: project store not ready.');
    }

    const insertAsset = insertAssetInProject({
      openFile: filesystem.openFile,
      readBinaryFile: filesystem.readBinaryFile,
      lookupAssetByName: projectStore.lookupAssetByName,
      addAssetToProject: projectStore.addAssetToProject,
      getProjectRelativePath: projectStore.getProjectRelativePath,
      assetsDirName: projectStore.assetsDirName,
    });

    const result = await Effect.runPromise(
      pipe(
        parseProjectRelPathEffect(docPathString),
        Effect.flatMap((resolvedDocPath) =>
          pipe(
            insertAsset({ projectId }),
            Effect.flatMap((inserted) =>
              Option.match(inserted, {
                onNone: () => Effect.succeed(null),
                onSome: ({ relPath }) =>
                  pipe(
                    parseProjectRelPathEffect(relPath),
                    Effect.map((projectRel) => ({
                      src: projectRelToDocRel({
                        projectRel,
                        docPath: resolvedDocPath,
                      }),
                      // No default alt/caption — an asset only gets one when the
                      // user authors it, so implicit figures stay caption-less.
                      alt: null,
                      title: null,
                    }))
                  ),
              })
            )
          )
        )
      )
    );

    if (result) {
      await refreshDirectoryTree();
    }

    return result;
  }, [
    projectId,
    filesystem,
    projectStore,
    docPathString,
    refreshDirectoryTree,
  ]);
};
