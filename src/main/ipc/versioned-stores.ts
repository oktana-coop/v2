import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { ipcMain } from 'electron';

import {
  type AddDocumentToMultiDocumentProjectArgs,
  type CreateMultiDocumentProjectArgs,
  type DeleteDocumentFromMultiDocumentProjectArgs,
  type FindDocumentInMultiDocumentProjectArgs,
  type MultiDocumentProjectStoreManager,
  OpenMultiDocumentProjectByIdArgs,
  type OpenSingleDocumentProjectStoreArgs,
  type ProjectId,
  type SetupSingleDocumentProjectStoreArgs,
  type SingleDocumentProjectStoreManager,
  ValidationError as VersionedProjectValidationError,
} from '../../modules/domain/project/node';
import {
  type CommitChangesArgs,
  type CreateDocumentArgs,
  type GetDocumentAtChangeArgs,
  type IsContentSameAtChangesArgs,
  type UpdateRichTextDocumentContentArgs,
} from '../../modules/domain/rich-text';
import { runPromiseSerializingErrorsForIPC } from '../../modules/infrastructure/cross-platform/electron-ipc-effect';
import { Filesystem } from '../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../modules/infrastructure/version-control';
import {
  getVersionedStores,
  isMultiDocumentProjectVersionedStores,
  setVersionedStores,
  validateProjectIdAndGetVersionedStores,
} from '../versioned-stores';

export const registerVersionedStoresEvents = ({
  singleDocumentProjectStoreManager,
  multiDocumentProjectStoreManager,
  filesystem,
}: {
  singleDocumentProjectStoreManager: SingleDocumentProjectStoreManager;
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
  filesystem: Filesystem;
}) => {
  registerStoreManagerEvents({
    singleDocumentProjectStoreManager,
    multiDocumentProjectStoreManager,
    filesystem,
  });
  registerMultiDocumentProjectStoreEvents();
  registerVersionedDocumentStoreEvents();
};

const registerStoreManagerEvents = ({
  singleDocumentProjectStoreManager,
  multiDocumentProjectStoreManager,
  filesystem,
}: {
  singleDocumentProjectStoreManager: SingleDocumentProjectStoreManager;
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
  filesystem: Filesystem;
}) => {
  ipcMain.handle(
    'create-single-document-project',
    async (_, { name }: SetupSingleDocumentProjectStoreArgs) =>
      Effect.runPromise(
        pipe(
          singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
            filesystem,
          })({ name }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(({ projectId, documentId, file, name }) => ({
            projectId,
            documentId,
            file,
            name,
          }))
        )
      )
  );

  ipcMain.handle(
    'open-single-document-project',
    async (_, { fromFile }: OpenSingleDocumentProjectStoreArgs) =>
      Effect.runPromise(
        pipe(
          singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
            filesystem,
          })({ fromFile }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(({ projectId, documentId, file, name }) => ({
            projectId,
            documentId,
            file,
            name,
          }))
        )
      )
  );

  ipcMain.handle('open-or-create-multi-document-project', async () =>
    Effect.runPromise(
      pipe(
        multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
          filesystem,
        })(),
        Effect.tap(
          ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
            setVersionedStores(projectId, {
              versionedProjectStore,
              versionedDocumentStore,
            })
        ),
        Effect.map(({ projectId, directory }) => ({
          projectId,
          directory,
        }))
      )
    )
  );

  ipcMain.handle(
    'open-multi-document-project-by-id',
    async (_, { projectId, directoryPath }: OpenMultiDocumentProjectByIdArgs) =>
      Effect.runPromise(
        pipe(
          multiDocumentProjectStoreManager.openMultiDocumentProjectById({
            filesystem,
          })({ projectId, directoryPath }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(({ projectId, directory }) => ({
            projectId,
            directory,
          }))
        )
      )
  );
};

const registerMultiDocumentProjectStoreEvents = () => {
  ipcMain.handle(
    'multi-document-project-store:create-project',
    async (_, args: CreateMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.path),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:find-project-by-id',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(id),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findProjectById(id)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:list-project-documents',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(id),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listProjectDocuments(id)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:add-document-to-project',
    async (_, args: AddDocumentToMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.addDocumentToProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:delete-document-from-project',
    async (_, args: DeleteDocumentFromMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteDocumentFromProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:find-document-in-project',
    async (_, args: FindDocumentInMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findDocumentInProject(args)
          )
        )
      )
  );
};

const registerVersionedDocumentStoreEvents = () => {
  ipcMain.handle(
    'versioned-document-store:set-project-id',
    async (_, id: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(id),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.setProjectId(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:create-document',
    async (_, args: CreateDocumentArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.createDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:find-document-by-id',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.findDocumentById(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-last-change-id',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentLastChangeId(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:update-rich-text-document-content',
    async (_, args: UpdateRichTextDocumentContentArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.updateRichTextDocumentContent(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:delete-document',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.deleteDocument(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:commit-changes',
    async (_, args: CommitChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.commitChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-history',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentHistory(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-at-change',
    async (_, args: GetDocumentAtChangeArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentAtChange(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:is-content-same-at-changes',
    async (_, args: IsContentSameAtChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.isContentSameAtChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:disconnect',
    async (_, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.disconnect()
          )
        )
      )
  );
};
