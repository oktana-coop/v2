import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { useCallback, useContext } from 'react';

import {
  insertAssetInMultiDocumentProject,
  insertAssetInSingleDocumentProject,
  parseProjectRelPath,
  projectRelToDocRel,
  projectTypes,
} from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';
import { useProjectId } from './use-project-id';

export type InsertAssetIntoProjectResult = {
  relPath: string;
  alt: string;
};

// Composes the asset-insert command from renderer-bound deps (filesystem
// adapter + project-store adapter). The command itself owns the
// file-picker step (including the allowed extensions), so callers just
// invoke this and either get back the inserted asset or `null` for
// cancellation.
export const useInsertAssetIntoProject = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const projectId = useProjectId();
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const { versionedProjectStore: multiDocStore, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const { versionedProjectStore: singleDocStore } = useContext(
    SingleDocumentProjectContext
  );
  // The figure's `src` attr (and the on-disk Markdown) is document-relative.
  // The asset-insert command returns project-relative; we rewrite here.
  const docPath = selectedFileInfo?.path
    ? parseProjectRelPath(selectedFileInfo.path)
    : null;

  return useCallback(async (): Promise<InsertAssetIntoProjectResult | null> => {
    if (!projectId) {
      throw new Error('Cannot insert asset: no current project.');
    }
    if (!docPath) {
      // TODO: wire the single-doc project's doc path through this hook.
      throw new Error('Cannot insert asset: no doc path.');
    }

    const isMultiDoc = projectType === projectTypes.MULTI_DOCUMENT_PROJECT;
    const store = isMultiDoc ? multiDocStore : singleDocStore;
    if (!store) {
      throw new Error('Cannot insert asset: project store not ready.');
    }

    const command = isMultiDoc
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

    const result = await Effect.runPromise(command({ projectId }));
    return Option.match(result, {
      onNone: () => null,
      onSome: ({ relPath: projectRelPath, alt }) => ({
        relPath: projectRelToDocRel({
          projectRel: parseProjectRelPath(projectRelPath),
          docPath,
        }),
        alt,
      }),
    });
  }, [
    projectType,
    projectId,
    filesystem,
    multiDocStore,
    singleDocStore,
    docPath,
  ]);
};
