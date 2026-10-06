import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useState } from 'react';

import {
  type ProjectRelPath,
  VersionedProjectDeletedDocumentErrorTag,
} from '../../../../../../modules/domain/project';
import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type ChangeId,
  type CommitId,
  parseGitCommitHash,
} from '../../../../../../modules/infrastructure/version-control';
import {
  InfrastructureAdaptersContext,
  ProjectContext,
} from '../../../../app-state';
import { type DiffViewProps } from './ReadOnlyDocumentView';

export type UseHistoricalRichTextDocumentArgs = {
  documentId: ArtifactId;
  documentPath: ProjectRelPath;
  changeId: ChangeId | null;
  diffCommitId: CommitId | null;
};

export type UseHistoricalRichTextDocumentResult = {
  doc: VersionedDocument | null;
  diffProps: DiffViewProps | null;
  loading: boolean;
  error: string | null;
};

export const useHistoricalRichTextDocument = ({
  documentId,
  documentPath,
  changeId,
  diffCommitId,
}: UseHistoricalRichTextDocumentArgs): UseHistoricalRichTextDocumentResult => {
  const { projectId } = useContext(ProjectContext);
  const { projectStore } = useContext(InfrastructureAdaptersContext);

  const [doc, setDoc] = useState<VersionedDocument | null>(null);
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);
  const [loading, setLoading] = useState(changeId !== null);
  const [error, setError] = useState<string | null>(null);

  const getDocumentAtChange = useCallback(
    async (args: { documentId: ArtifactId; changeId: ChangeId }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }
      return Effect.runPromise(
        pipe(
          projectStore.getDocumentAtChange({ projectId, ...args }),
          // When the document was deleted in this commit, fall back to the
          // parent commit to show the last known content.
          Effect.catchTag(VersionedProjectDeletedDocumentErrorTag, (e) =>
            e.data.parentCommitId
              ? projectStore.getDocumentAtChange({
                  projectId,
                  ...args,
                  changeId: parseGitCommitHash(e.data.parentCommitId),
                })
              : Effect.fail(e)
          )
        )
      );
    },
    [projectStore, projectId]
  );

  const isContentSameAtChanges = useCallback(
    async (args: {
      documentId: ArtifactId;
      change1: ChangeId;
      change2: ChangeId;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }
      return Effect.runPromise(
        projectStore.isContentSameAtChanges({ projectId, ...args })
      );
    },
    [projectStore, projectId]
  );

  useEffect(() => {
    let isLatest = true;

    const loadDocOrDiff = async () => {
      if (!changeId) return;

      setLoading(true);
      setError(null);
      setDiffProps(null);

      try {
        const currentDoc = await getDocumentAtChange({
          documentId,
          changeId,
        });

        if (!isLatest) return;

        if (diffCommitId) {
          const shouldSkipDiff = await isContentSameAtChanges({
            documentId,
            change1: diffCommitId,
            change2: changeId,
          }).catch(() => false);

          if (!isLatest) return;

          if (!shouldSkipDiff) {
            try {
              const diffTargetDoc = await getDocumentAtChange({
                documentId,
                changeId: diffCommitId,
              });

              if (!isLatest) return;

              if (diffTargetDoc && currentDoc) {
                setDiffProps({
                  docBefore: diffTargetDoc,
                  docAfter: currentDoc,
                  documentPath,
                });
              }
            } catch (error) {
              // TODO: handle errors like diff target not exsiting (e.g. file was added in this commit)
              console.error(error);
            }
          }
        }

        if (isLatest) {
          setDoc(currentDoc);
        }
      } catch {
        if (isLatest) {
          setError('Unable to load document content');
        }
      } finally {
        if (isLatest) {
          setLoading(false);
        }
      }
    };

    loadDocOrDiff();

    return () => {
      isLatest = false;
    };
  }, [
    documentId,
    documentPath,
    changeId,
    diffCommitId,
    getDocumentAtChange,
    isContentSameAtChanges,
  ]);

  return { doc, diffProps, loading, error };
};
