import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { type VersionControlId } from '../../../../modules/infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../errors';
import { type VersionedProjectStore } from '../ports/versioned-project-store';

export type CreateVersionedDocumentArgs = {
  title: string;
  name: string;
  path: string;
  content: string | null;
  projectId: VersionControlId | null;
};

export type CreateVersionedDocumentDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  addDocumentToProject: VersionedProjectStore['addDocumentToProject'];
};

export const createVersionedDocument =
  ({ createDocument, addDocumentToProject }: CreateVersionedDocumentDeps) =>
  ({
    title,
    name,
    path,
    content,
    projectId,
  }: CreateVersionedDocumentArgs): Effect.Effect<
    VersionControlId,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError,
    never
  > =>
    pipe(
      createDocument({
        title,
        content,
      }),
      Effect.tap((documentId) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.as(undefined),
            onSome: (projId) =>
              addDocumentToProject({
                documentId,
                name,
                path,
                projectId: projId,
              }),
          })
        )
      )
    );
