import { useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import {
  artifactKinds,
  inferArtifactKindFromExtension,
} from '../../../../../../../modules/domain/project';
import { type RichTextDocument } from '../../../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  type CompareContentConflict as CompareContentConflictType,
  isContentConflict,
} from '../../../../../../../modules/infrastructure/version-control';
import { ProjectContext } from '../../../../../app-state';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';
import { UnsupportedConflict } from '../UnsupportedConflict';
import { useMergeConflictResolution } from '../use-merge-conflict-resolution';
import {
  type PlainTextConflictEdit,
  PlainTextContentConflict,
} from './plain-text/PlainTextContentConflict';
import { RichTextContentConflict } from './rich-text/RichTextContentConflict';

export const CompareContentConflictResolution = () => {
  const { compareContentPath } = useParams();
  const { projectId } = useContext(ProjectContext);
  const { view: editorView } = useContext(ProseMirrorContext);
  const {
    mergeConflictInfo,
    compareContentConflicts,
    abortMerge,
    resolveRichTextContentConflict,
    resolvePlainTextContentConflict,
  } = useMergeConflictResolution();
  const [conflict, setConflict] = useState<CompareContentConflictType | null>(
    null
  );
  const [richTextEdits] = useState<Record<string, RichTextDocument>>({});
  const [plainTextEdits, setPlainTextEdits] = useState<
    Record<string, PlainTextConflictEdit>
  >({});
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(true);

  const isPlainTextConflict =
    conflict !== null &&
    inferArtifactKindFromExtension(conflict.path) ===
      artifactKinds.PLAIN_TEXT_DOCUMENT;
  const plainTextEdit = conflict ? plainTextEdits[conflict.path] : undefined;
  const canResolvePlainTextConflict =
    plainTextEdit !== undefined && !plainTextEdit.hasMergeConflictMarkers;

  useEffect(() => {
    const selectedConflict = compareContentConflicts.find(
      (conf) => conf.path === compareContentPath
    );
    setConflict(selectedConflict ?? null);
  }, [compareContentConflicts, compareContentPath]);

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  const handleSetShowDiff = (checked: boolean) => {
    setShowDiff(checked);
  };

  const handleAbortMerge = () => {
    abortMerge();
  };

  const handleRichTextEdit =
    (path: string) => async (doc: RichTextDocument) => {
      richTextEdits[path] = doc;
    };

  const handlePlainTextEdit =
    (path: string) => (edit: PlainTextConflictEdit) => {
      setPlainTextEdits((edits) => ({
        ...edits,
        [path]: edit,
      }));
    };

  const handleResolveConflict = async () => {
    if (!projectId || !conflict) {
      return;
    }

    if (isPlainTextConflict) {
      if (plainTextEdit && canResolvePlainTextConflict) {
        await resolvePlainTextContentConflict({
          documentId: conflict.targetArtifactId,
          projectId,
          content: plainTextEdit.content,
        });
      }
      return;
    }

    if (richTextEdits[conflict.path]) {
      await resolveRichTextContentConflict({
        documentId: conflict.targetArtifactId,
        projectId,
        doc: richTextEdits[conflict.path],
      });
    }
  };

  const conflictView = () => {
    if (!conflict || !mergeConflictInfo) {
      return <LongTextSkeleton />;
    }

    // TODO: Implement AddAddConflict.
    // In this case it's probably best to ask from the user
    // to select one of the two versions instead of comparing.
    if (!isContentConflict(conflict)) {
      return (
        <UnsupportedConflict>
          v2 is not yet able to handle this conflict type. Please reach out to
          us for support.
        </UnsupportedConflict>
      );
    }

    if (isPlainTextConflict) {
      return (
        <PlainTextContentConflict
          key={conflict.path}
          conflict={conflict}
          onEdit={handlePlainTextEdit(conflict.path)}
        />
      );
    }

    return (
      <RichTextContentConflict
        conflict={conflict}
        mergeConflictInfo={mergeConflictInfo}
        isEditorToolbarOpen={isEditorToolbarOpen}
        showDiff={showDiff}
        onDocChange={handleRichTextEdit(conflict.path)}
      />
    );
  };

  if (!mergeConflictInfo) {
    return null;
  }

  return (
    <div className="relative flex w-full flex-col overflow-hidden">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          mergeConflictInfo={mergeConflictInfo}
          hasEditorToolbarToggle={!isPlainTextConflict}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          onAbortMerge={handleAbortMerge}
          hasResolveConflictButton
          isResolveConflictDisabled={
            isPlainTextConflict && !canResolvePlainTextConflict
          }
          onResolveConflict={handleResolveConflict}
          hasShowDiffCheckbox={!isPlainTextConflict}
          showDiff={showDiff}
          onSetShowDiffChecked={handleSetShowDiff}
        />
      </div>
      {isPlainTextConflict ? (
        <div className="flex min-h-0 w-full flex-auto flex-col">
          {conflictView()}
        </div>
      ) : (
        <div className="flex w-full flex-auto flex-col items-center overflow-auto">
          <div className="flex w-full max-w-3xl flex-col">{conflictView()}</div>
        </div>
      )}
    </div>
  );
};
