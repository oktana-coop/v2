import { EditorView } from '@codemirror/view';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  type Linter,
  type PlainTextAndFormat,
  plainTextToRawPlainText,
  type RawPlainText,
  type RawPlainTextFormat,
  rawPlainTextToPlainText,
  toPlainText,
} from '../../../../../../../../modules/domain/plain-text';
import {
  editing,
  lint,
  mergeConflicts,
} from '../../../../../../../../modules/domain/plain-text/codemirror';
import {
  type ContentConflict,
  hasMergeConflictMarkers,
} from '../../../../../../../../modules/infrastructure/version-control';
import {
  InfrastructureAdaptersContext,
  ProjectContext,
} from '../../../../../../app-state';
import {
  CodeMirrorEditor,
  type EditorSeed,
} from '../../../../../../components/plain-text-editing/CodeMirrorEditor';
import { usePlainTextLanguage } from '../../../../../../components/plain-text-editing/use-plain-text-language';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import { ContentLoadError } from '../../../../shared/historical-view/ContentLoadError';

// The file's content as edited so far, in the file's format.
export type PlainTextConflictEdit = {
  content: RawPlainText;
  hasMergeConflictMarkers: boolean;
};

const toConflictEdit = ({
  text,
  format,
}: {
  text: string;
  format: RawPlainTextFormat;
}): PlainTextConflictEdit => ({
  content: plainTextToRawPlainText({ text: toPlainText(text), format }),
  hasMergeConflictMarkers: hasMergeConflictMarkers(text),
});

// Edits the file as the merge left it, with the regions the merge marked as
// conflicting, and reports the content after every change.
export const PlainTextContentConflict = ({
  conflict,
  onEdit,
}: {
  conflict: ContentConflict;
  onEdit: (edit: PlainTextConflictEdit) => void;
}) => {
  const { projectId } = useContext(ProjectContext);
  const { projectStore } = useContext(InfrastructureAdaptersContext);
  const { language, linter } = usePlainTextLanguage(conflict.path);
  // The markers themselves would be the errors, so linting starts once none
  // remain.
  const linterWithoutMarkers = useMemo(
    (): Linter | null =>
      linter && {
        lint: (text) =>
          hasMergeConflictMarkers(text)
            ? Effect.succeed([])
            : linter.lint(text),
      },
    [linter]
  );
  const [merged, setMerged] = useState<PlainTextAndFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A new callback must not recreate the editor and lose the edits.
  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  });

  useEffect(() => {
    if (!projectStore || !projectId) return;

    let isLatest = true;

    Effect.runPromise(
      pipe(
        projectStore.findPlainTextDocumentById({
          projectId,
          documentId: conflict.targetArtifactId,
        }),
        Effect.flatMap(rawPlainTextToPlainText)
      )
    )
      .then((textAndFormat) => {
        if (!isLatest) return;
        setMerged(textAndFormat);
        onEditRef.current(toConflictEdit(textAndFormat));
      })
      .catch((e) => {
        if (!isLatest) return;
        console.error(e);
        setError('Unable to load document content');
      });

    return () => {
      isLatest = false;
    };
  }, [projectStore, projectId, conflict.targetArtifactId]);

  const seed = useMemo(
    (): EditorSeed | null =>
      merged && {
        doc: merged.text,
        language,
        extensions: [
          editing,
          linterWithoutMarkers ? lint(linterWithoutMarkers) : [],
          mergeConflicts,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onEditRef.current(
                toConflictEdit({
                  text: update.state.doc.toString(),
                  format: merged.format,
                })
              );
            }
          }),
        ],
      },
    [merged, language, linterWithoutMarkers]
  );

  if (error) {
    return <ContentLoadError message={error} />;
  }

  if (!seed) {
    return <LongTextSkeleton />;
  }

  return <CodeMirrorEditor seed={seed} />;
};
