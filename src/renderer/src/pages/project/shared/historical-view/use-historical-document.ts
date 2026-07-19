import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import {
  type ProjectRelPath,
  VersionedProjectDeletedDocumentErrorTag,
} from '../../../../../../modules/domain/project';
import { type VersionedDocument } from '../../../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Change,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type CommitId,
  type CommitWithUrlInfo,
  decodeUrlEncodedArtifactId,
  decodeUrlEncodedCommitId,
  isCommitWithUrlInfo,
  isUncommittedChangeId,
  parseGitCommitHash,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import {
  InfrastructureAdaptersContext,
  ProjectContext,
  useArtifactMetaData,
  useCurrentChangeId,
  useNavigateToArtifact,
} from '../../../../app-state';
import { resolveDiffState } from './diff-state';
import { type DiffViewProps } from './ReadOnlyDocumentView';

export type UseHistoricalDocumentArgs = {
  changes: ChangeWithUrlInfo[];
};

export type UseHistoricalDocumentResult = {
  documentId: ArtifactId | null;
  changeId: ChangeId | null;
  documentPath: ProjectRelPath | null;
  isUncommitted: boolean;
  selectedChange: Change | null;
  navigateToEdit: () => void;
  doc: VersionedDocument | null;
  diffProps: DiffViewProps | null;
  loading: boolean;
  error: string | null;
  showDiff: boolean;
  onSetShowDiff: (value: boolean) => void;
  diffCommitId: CommitId | null;
  onDiffCommitSelect: (id: CommitId) => void;
  canShowDiff: boolean;
  diffSelectorCommits: CommitWithUrlInfo[];
};

export const useHistoricalDocument = ({
  changes,
}: UseHistoricalDocumentArgs): UseHistoricalDocumentResult => {
  const { artifactId: encodedDocumentId } = useParams();
  const changeId = useCurrentChangeId();
  const { projectId } = useContext(ProjectContext);
  const { projectStore } = useContext(InfrastructureAdaptersContext);
  const { showDiffInHistoryView, setShowDiffInHistoryView } = useContext(
    FunctionalityConfigContext
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const navigateToArtifact = useNavigateToArtifact();

  const documentId = useMemo(
    () =>
      encodedDocumentId ? decodeUrlEncodedArtifactId(encodedDocumentId) : null,
    [encodedDocumentId]
  );

  const { artifact: historicalArtifact } = useArtifactMetaData(documentId);
  const documentPath = historicalArtifact?.path ?? null;

  const isUncommitted = useMemo(
    () => (changeId ? isUncommittedChangeId(changeId) : false),
    [changeId]
  );

  const selectedChange = useMemo(
    () =>
      changeId
        ? (changes.find((c) => changeIdsAreSame(c.id, changeId)) ?? null)
        : null,
    [changeId, changes]
  );

  const navigateToEdit = useCallback(() => {
    if (projectId && documentId) {
      navigateToArtifact({
        projectId,
        artifactId: documentId,
      });
    }
  }, [projectId, documentId, navigateToArtifact]);

  const diffWithParam = useMemo((): CommitId | null => {
    const param = searchParams.get('diffWith');
    return param ? decodeUrlEncodedCommitId(param) : null;
  }, [searchParams]);

  const commits = useMemo(() => changes.filter(isCommitWithUrlInfo), [changes]);

  const { diffCommitId, canShowDiff, diffSelectorCommits } = useMemo(
    () =>
      resolveDiffState({
        commits,
        changeId,
        userWantsDiff: showDiffInHistoryView,
        diffWithParam,
      }),
    [commits, changeId, showDiffInHistoryView, diffWithParam]
  );

  const onSetShowDiff = useCallback(
    (checked: boolean) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (checked) {
          newParams.set('showDiff', 'true');
        } else {
          newParams.delete('showDiff');
        }
        return newParams;
      });
      setShowDiffInHistoryView(checked);
    },
    [setSearchParams, setShowDiffInHistoryView]
  );

  const onDiffCommitSelect = useCallback(
    (id: CommitId) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('diffWith', urlEncodeChangeId(id));
        return newParams;
      });
    },
    [setSearchParams]
  );

  const [doc, setDoc] = useState<VersionedDocument | null>(null);
  const [diffProps, setDiffProps] = useState<DiffViewProps | null>(null);
  const [loading, setLoading] = useState(false);
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
      if (!documentId || !changeId) return;

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

              if (diffTargetDoc && currentDoc && documentPath) {
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

  return {
    documentId,
    changeId,
    documentPath,
    isUncommitted,
    selectedChange,
    navigateToEdit,
    doc,
    diffProps,
    loading,
    error,
    showDiff: showDiffInHistoryView,
    onSetShowDiff,
    diffCommitId,
    onDiffCommitSelect,
    canShowDiff,
    diffSelectorCommits,
  };
};
