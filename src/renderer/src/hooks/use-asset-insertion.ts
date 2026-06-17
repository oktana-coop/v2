import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { useCallback, useContext } from 'react';

import {
  insertAssetInMultiDocumentProject,
  insertAssetInSingleDocumentProject,
  parseProjectRelPathEffect,
  projectRelToDocRel,
  projectTypes,
} from '../../../modules/domain/project';
import { type DocumentAsset } from '../../../modules/domain/rich-text';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';
import { useProjectId } from './use-project-id';

export const useAssetInsertion = (
  docPath?: string
): (() => Promise<DocumentAsset | null>) => {
  const { projectType } = useContext(CurrentProjectContext);
  const projectId = useProjectId();
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const {
    versionedProjectStore: multiDocStore,
    selectedFileInfo,
    refreshDirectoryTree,
  } = useContext(MultiDocumentProjectContext);
  const { versionedProjectStore: singleDocStore, documentProjectRelPath } =
    useContext(SingleDocumentProjectContext);

  const isMultiDocProject = projectType === projectTypes.MULTI_DOCUMENT_PROJECT;

  const docPathString =
    docPath ??
    (isMultiDocProject ? selectedFileInfo?.path : documentProjectRelPath);

  return useCallback(async (): Promise<DocumentAsset | null> => {
    if (!projectId) {
      throw new Error('Cannot insert asset: no current project.');
    }
    if (!docPathString) {
      // No doc path to anchor the asset's relative src — e.g. an automerge
      // single-doc project, which exposes no filesystem workdir path.
      throw new Error('Cannot insert asset: no doc path.');
    }

    const store = isMultiDocProject ? multiDocStore : singleDocStore;
    if (!store) {
      throw new Error('Cannot insert asset: project store not ready.');
    }

    const insertAssetInProject = isMultiDocProject
      ? insertAssetInMultiDocumentProject({
          openFile: filesystem.openFile,
          readBinaryFile: filesystem.readBinaryFile,
          lookupAssetByName: multiDocStore!.lookupAssetByName,
          addAssetToProject: multiDocStore!.addAssetToProject,
          getProjectRelativePath: multiDocStore!.getProjectRelativePath,
          assetsDirName: multiDocStore!.assetsDirName,
        })
      : insertAssetInSingleDocumentProject({
          openFile: filesystem.openFile,
          readBinaryFile: filesystem.readBinaryFile,
          lookupAssetByName: singleDocStore!.lookupAssetByName,
          addAssetToProject: singleDocStore!.addAssetToProject,
          assetsDirName: singleDocStore!.assetsDirName,
        });

    const result = await Effect.runPromise(
      pipe(
        parseProjectRelPathEffect(docPathString),
        Effect.flatMap((resolvedDocPath) =>
          pipe(
            insertAssetInProject({ projectId }),
            Effect.flatMap((inserted) =>
              Option.match(inserted, {
                onNone: () => Effect.succeed(null),
                onSome: ({ relPath, alt }) =>
                  pipe(
                    parseProjectRelPathEffect(relPath),
                    Effect.map((projectRel) => ({
                      src: projectRelToDocRel({
                        projectRel,
                        docPath: resolvedDocPath,
                      }),
                      alt,
                      title: null,
                    }))
                  ),
              })
            )
          )
        )
      )
    );

    if (result && isMultiDocProject) {
      await refreshDirectoryTree();
    }

    return result;
  }, [
    isMultiDocProject,
    projectId,
    filesystem,
    multiDocStore,
    singleDocStore,
    docPathString,
    refreshDirectoryTree,
  ]);
};
