import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import {
  type VersionedDocument,
  VersionedDocumentDeletedDocumentErrorTag,
} from '../../../../../../modules/domain/rich-text';
import {
  type Change,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type CommitId,
  decodeUrlEncodedArtifactId,
  decodeUrlEncodedChangeId,
  decodeUrlEncodedCommitId,
  decomposeGitBlobRef,
  isGitBlobRef,
  isUncommittedChangeId,
  parseGitCommitHash,
  type ResolvedArtifactId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import { InfrastructureAdaptersContext } from '../../../../app-state';
import { useNavigateToDocument } from '../../../../hooks/use-navigate-to-document';
import { useProjectId } from '../../../../hooks/use-project-id';
import { type DiffViewProps } from './ReadOnlyDocumentView';

const resolveDiffState = ({
  changes,
  changeId,
  userWantsDiff,
  diffWithParam,
}: {
  changes: ChangeWithUrlInfo[];
  changeId: ChangeId | null;
  userWantsDiff: boolean;
  diffWithParam: CommitId | null;
}): {
  diffCommitId: CommitId | null;
  canShowDiff: boolean;
  diffSelectorCommits: ChangeWithUrlInfo[];
} => {
  const noDiff = {
    diffCommitId: null,
    canShowDiff: false,
    diffSelectorCommits: [] as ChangeWithUrlInfo[],
  };

  if (!changeId) return noDiff;

  const key = urlEncodeChangeId(changeId);
  const currentIndex = changes.findIndex((c) => c.urlEncodedChangeId === key);

  let defaultDiffCommitId: CommitId | null;
  let diffSelectorCommits: ChangeWithUrlInfo[];

  if (currentIndex < 0) {
    // Current change not in list (e.g. uncommitted in project history) —
    // diff against the most recent commit; all changes are eligible.
    defaultDiffCommitId =
      changes.length > 0 ? (changes[0].id as CommitId) : null;
    diffSelectorCommits = changes;
  } else if (currentIndex >= changes.length - 1) {
    // Current change is the oldest in the list — nothing to diff against.
    return noDiff;
  } else {
    // Normal case — diff against the next (older) change.
    defaultDiffCommitId = changes[currentIndex + 1].id as CommitId;
    diffSelectorCommits = changes.slice(currentIndex + 1);
  }

  if (!defaultDiffCommitId) return noDiff;

  const resolvedDiffCommit = diffWithParam ?? defaultDiffCommitId;

  return {
    diffCommitId: userWantsDiff ? resolvedDiffCommit : null,
    canShowDiff: true,
    diffSelectorCommits,
  };
};

export type UseHistoricalDocumentArgs = {
  changes: ChangeWithUrlInfo[];
};

export type UseHistoricalDocumentResult = {
  documentId: ResolvedArtifactId | null;
  changeId: ChangeId | null;
  documentPath: string | null;
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
  diffSelectorCommits: ChangeWithUrlInfo[];
};

export const useHistoricalDocument = ({
  changes,
}: UseHistoricalDocumentArgs): UseHistoricalDocumentResult => {
  const { documentId: encodedDocumentId, changeId: encodedChangeId } =
    useParams();
  const projectId = useProjectId();
  const { versionedDocumentStore } = useContext(InfrastructureAdaptersContext);
  const { showDiffInHistoryView, setShowDiffInHistoryView } = useContext(
    FunctionalityConfigContext
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const navigateToDocument = useNavigateToDocument();

  const documentId = useMemo(
    () =>
      encodedDocumentId ? decodeUrlEncodedArtifactId(encodedDocumentId) : null,
    [encodedDocumentId]
  );

  const changeId = useMemo(
    () => (encodedChangeId ? decodeUrlEncodedChangeId(encodedChangeId) : null),
    [encodedChangeId]
  );

  const documentPath = useMemo(
    () =>
      documentId && isGitBlobRef(documentId)
        ? decomposeGitBlobRef(documentId).path
        : null,
    [documentId]
  );

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
      navigateToDocument({ projectId, documentId, path: documentPath });
    }
  }, [projectId, documentId, documentPath, navigateToDocument]);

  const diffWithParam = useMemo((): CommitId | null => {
    const param = searchParams.get('diffWith');
    return param ? decodeUrlEncodedCommitId(param) : null;
  }, [searchParams]);

  const { diffCommitId, canShowDiff, diffSelectorCommits } = useMemo(
    () =>
      resolveDiffState({
        changes,
        changeId,
        userWantsDiff: showDiffInHistoryView,
        diffWithParam,
      }),
    [changes, changeId, showDiffInHistoryView, diffWithParam]
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
    async (args: { documentId: ResolvedArtifactId; changeId: ChangeId }) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }
      return Effect.runPromise(
        pipe(
          versionedDocumentStore.getDocumentAtChange(args),
          // When the document was deleted in this commit, fall back to the
          // parent commit to show the last known content.
          Effect.catchTag(VersionedDocumentDeletedDocumentErrorTag, (e) =>
            e.data.parentCommitId
              ? versionedDocumentStore.getDocumentAtChange({
                  ...args,
                  changeId: parseGitCommitHash(e.data.parentCommitId),
                })
              : Effect.fail(e)
          )
        )
      );
    },
    [versionedDocumentStore, projectId]
  );

  const isContentSameAtChanges = useCallback(
    async (args: {
      documentId: ResolvedArtifactId;
      change1: ChangeId;
      change2: ChangeId;
    }) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }
      return Effect.runPromise(
        versionedDocumentStore.isContentSameAtChanges(args)
      );
    },
    [versionedDocumentStore, projectId]
  );

  useEffect(() => {
    let isLatest = true;

    const loadDocOrDiff = async () => {
      if (!documentId || !changeId) return;

      setLoading(true);
      setError(null);
      setDoc(null);
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
