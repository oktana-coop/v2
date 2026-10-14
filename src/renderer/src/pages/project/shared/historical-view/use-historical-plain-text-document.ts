import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext, useEffect, useState } from 'react';

import {
  type PlainText,
  rawPlainTextToPlainText,
} from '../../../../../../modules/domain/plain-text';
import { VersionedProjectDeletedDocumentErrorTag } from '../../../../../../modules/domain/project';
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

export type UseHistoricalPlainTextDocumentArgs = {
  documentId: ArtifactId;
  changeId: ChangeId | null;
  diffCommitId: CommitId | null;
};

export type UseHistoricalPlainTextDocumentResult = {
  text: PlainText | null;
  // The text the changes are shown against, if any.
  diffBase: PlainText | null;
  loading: boolean;
  error: string | null;
};

export const useHistoricalPlainTextDocument = ({
  documentId,
  changeId,
  diffCommitId,
}: UseHistoricalPlainTextDocumentArgs): UseHistoricalPlainTextDocumentResult => {
  const { projectId } = useContext(ProjectContext);
  const { projectStore } = useContext(InfrastructureAdaptersContext);

  const [text, setText] = useState<PlainText | null>(null);
  const [diffBase, setDiffBase] = useState<PlainText | null>(null);
  const [loading, setLoading] = useState(changeId !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectStore || !projectId || !changeId) return;

    let isLatest = true;

    const textAt = (atChangeId: ChangeId) =>
      pipe(
        projectStore.getPlainTextDocumentAtChange({
          projectId,
          documentId,
          changeId: atChangeId,
        }),
        // When the document was deleted in this commit, fall back to the
        // parent commit to show the last known content.
        Effect.catchTag(VersionedProjectDeletedDocumentErrorTag, (e) =>
          e.data.parentCommitId
            ? projectStore.getPlainTextDocumentAtChange({
                projectId,
                documentId,
                changeId: parseGitCommitHash(e.data.parentCommitId),
              })
            : Effect.fail(e)
        ),
        Effect.flatMap(rawPlainTextToPlainText),
        Effect.map(({ text: atChange }) => atChange)
      );

    // Nothing to compare with when no change is chosen, when the content is
    // the same, or when the other version can't be read.
    const diffBaseFor = (comparedWith: CommitId | null) =>
      comparedWith === null
        ? Effect.succeed(null)
        : pipe(
            projectStore.isContentSameAtChanges({
              projectId,
              documentId,
              change1: comparedWith,
              change2: changeId,
            }),
            Effect.flatMap((isSame) =>
              isSame ? Effect.succeed(null) : textAt(comparedWith)
            ),
            Effect.catchAll((e) => {
              console.error(e);
              return Effect.succeed(null);
            })
          );

    setLoading(true);
    setError(null);
    setDiffBase(null);

    Effect.runPromise(
      Effect.all({
        atChange: textAt(changeId),
        base: diffBaseFor(diffCommitId),
      })
    )
      .then(({ atChange, base }) => {
        if (!isLatest) return;
        setText(atChange);
        setDiffBase(base);
      })
      .catch((e) => {
        if (!isLatest) return;
        console.error(e);
        setError('Unable to load document content');
      })
      .finally(() => {
        if (isLatest) setLoading(false);
      });

    return () => {
      isLatest = false;
    };
  }, [projectStore, projectId, documentId, changeId, diffCommitId]);

  return { text, diffBase, loading, error };
};
