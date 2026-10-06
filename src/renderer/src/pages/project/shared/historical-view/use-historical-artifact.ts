import { useCallback, useContext, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';

import {
  type ArtifactKind,
  type ProjectRelPath,
} from '../../../../../../modules/domain/project';
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
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import {
  ProjectContext,
  useArtifactMetaData,
  useCurrentChangeId,
  useNavigateToArtifact,
} from '../../../../app-state';
import { resolveDiffState } from './diff-state';

export type UseHistoricalArtifactArgs = {
  changes: ChangeWithUrlInfo[];
};

export type UseHistoricalArtifactResult = {
  documentId: ArtifactId | null;
  changeId: ChangeId | null;
  documentPath: ProjectRelPath | null;
  kind: ArtifactKind | null;
  resolvingArtifact: boolean;
  isUncommitted: boolean;
  selectedChange: Change | null;
  navigateToEdit: () => void;
  showDiff: boolean;
  onSetShowDiff: (value: boolean) => void;
  diffCommitId: CommitId | null;
  onDiffCommitSelect: (id: CommitId) => void;
  canShowDiff: boolean;
  diffSelectorCommits: CommitWithUrlInfo[];
};

export const useHistoricalArtifact = ({
  changes,
}: UseHistoricalArtifactArgs): UseHistoricalArtifactResult => {
  const { artifactId: encodedDocumentId } = useParams();
  const changeId = useCurrentChangeId();
  const { projectId } = useContext(ProjectContext);
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

  const { artifact: historicalArtifact, resolving: resolvingArtifact } =
    useArtifactMetaData(documentId);
  const documentPath = historicalArtifact?.path ?? null;
  const kind = historicalArtifact?.kind ?? null;

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

  return {
    documentId,
    changeId,
    documentPath,
    kind,
    resolvingArtifact,
    isUncommitted,
    selectedChange,
    navigateToEdit,
    showDiff: showDiffInHistoryView,
    onSetShowDiff,
    diffCommitId,
    onDiffCommitSelect,
    canShowDiff,
    diffSelectorCommits,
  };
};
