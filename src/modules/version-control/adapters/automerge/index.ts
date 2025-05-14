import { next as Automerge } from '@automerge/automerge/slim';
import { RawString, Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { fromNullable } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import { versionControlItemTypes } from '../../constants/version-control-item-types';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type DocumentMetaData,
  type Project,
  type RichTextDocument,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
  type VersionedProject,
  type VersionedProjectHandle,
} from '../../models';
import { VersionControlRepo } from '../../ports/version-control-repo';

export const createAdapter = (automergeRepo: Repo): VersionControlRepo => {
  const getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<
    VersionedProject,
    RepositoryError | NotFoundError,
    never
  > = (handle) =>
    pipe(
      Effect.tryPromise({
        try: async () => await handle.doc(),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),

      Effect.flatMap((doc) =>
        fromNullable(
          doc,
          () => new NotFoundError('Project not found in handle')
        )
      )
    );

  const createProject: VersionControlRepo['createProject'] = ({ path }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<Project>({
            path,
            documents: {},
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url)
    );

  const findProjectById: VersionControlRepo['findProjectById'] = (
    id: VersionControlId
  ) =>
    pipe(
      Effect.tryPromise({
        try: () => automergeRepo.find<Project>(id),
        catch: (err: unknown) => {
          // TODO: This is not-future proof as it depends on the error message. Find a better way.
          if (err instanceof Error && err.message.includes('unavailable')) {
            return new NotFoundError(err.message);
          }

          return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
        },
      })
    );

  const listProjectDocuments: VersionControlRepo['listProjectDocuments'] = (
    id: VersionControlId
  ) =>
    pipe(
      findProjectById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.map((project) => Object.values(project.documents))
    );

  const addDocumentToProject = ({
    documentId,
    name,
    path,
    projectId,
  }: {
    documentId: VersionControlId;
    name: string;
    path: string;
    projectId: VersionControlId;
  }): Effect.Effect<void, RepositoryError | NotFoundError, never> =>
    pipe(
      findProjectById(projectId),
      Effect.flatMap((projectHandle) => {
        const metaData: DocumentMetaData = {
          versionControlId: documentId,
          name,
          path,
        };

        return Effect.try({
          try: () =>
            projectHandle.change((project) => {
              project.documents[documentId] = metaData;
            }),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        });
      })
    );

  const createDocument: VersionControlRepo['createDocument'] = ({
    title,
    name,
    path,
    content,
    projectId,
  }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<RichTextDocument>({
            type: versionControlItemTypes.RICH_TEXT_DOCUMENT,
            title,
            content: content ?? '',
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url),
      Effect.tap((documentId) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.succeed(false),
            onSome: (projId) =>
              pipe(
                addDocumentToProject({
                  documentId,
                  name,
                  path,
                  projectId: projId,
                }),
                () => Effect.succeed(true)
              ),
          })
        )
      )
    );

  const getDocumentHandleAtCommit: VersionControlRepo['getDocumentHandleAtCommit'] =
    ({ documentHandle, heads }) =>
      Effect.try({
        try: () => documentHandle.view(heads),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      });

  const findDocumentById: VersionControlRepo['findDocumentById'] = (
    id: VersionControlId
  ) =>
    pipe(
      Effect.tryPromise({
        try: () => automergeRepo.find<RichTextDocument>(id),
        catch: (err: unknown) => {
          // TODO: This is not-future proof as it depends on the error message. Find a better way.
          if (err instanceof Error && err.message.includes('unavailable')) {
            return new NotFoundError(err.message);
          }

          return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
        },
      })
    );

  const deleteDocumentFromProject: VersionControlRepo['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      pipe(
        Effect.all([findProjectById(projectId), findDocumentById(documentId)]),
        Effect.tap(([projectHandle]) =>
          Effect.try({
            try: () =>
              projectHandle.change((project) => {
                delete project.documents[documentId];
              }),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        ),
        Effect.tap(([, documentHandle]) =>
          Effect.try({
            try: () => documentHandle.delete(),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        )
      );

  const findDocumentInProject: VersionControlRepo['findDocumentInProject'] = ({
    projectId,
    documentPath,
  }) =>
    pipe(
      listProjectDocuments(projectId),
      Effect.flatMap((projectDocuments) =>
        pipe(
          Option.fromNullable(
            projectDocuments.find(
              (documentMetaData) => documentMetaData.path === documentPath
            )
          ),
          Option.match({
            onNone: () =>
              Effect.fail(new NotFoundError('Document not found in project')),
            onSome: (documentMetaData) =>
              Effect.succeed(documentMetaData.versionControlId),
          })
        )
      ),
      Effect.flatMap(findDocumentById)
    );

  const updateDocumentSpans: VersionControlRepo['updateDocumentSpans'] = ({
    documentHandle,
    spans,
  }) =>
    Effect.try({
      try: () =>
        documentHandle.change((doc) => {
          Automerge.updateSpans(
            doc,
            ['content'],
            spans.map((span) =>
              span.type === 'block'
                ? // Manually create the raw string for block types
                  {
                    ...span,
                    value: {
                      ...span.value,
                      type: new RawString(span.value.type as string),
                    },
                  }
                : // Inline span as-is
                  span
            )
          );
        }),
      catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
    });

  return {
    createProject,
    findProjectById,
    listProjectDocuments,
    createDocument,
    getDocumentHandleAtCommit,
    findDocumentById,
    deleteDocumentFromProject,
    findDocumentInProject,
    updateDocumentSpans,
  };
};
