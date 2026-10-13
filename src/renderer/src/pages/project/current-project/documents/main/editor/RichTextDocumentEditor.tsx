import { useCallback, useContext, useMemo, useState } from 'react';

import { uniqueParticipants } from '../../../../../../../../modules/domain/collaboration';
import { ProseMirrorContext } from '../../../../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  CommitModalContext,
  CurrentArtifactVersioningContext,
  CurrentDocumentContext,
  useAssetInsertion,
  useAssetSrcResolver,
  useCurrentRichTextDocument,
  useRemotePresence,
} from '../../../../../../app-state';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import { LiveRichTextDocumentEditor } from '../../../../../../components/rich-text-editing/LiveRichTextDocumentEditor';
import { ActionsBar } from '../../../../../shared/document-actions-bar';
import { useCurrentArtifact } from '../../../artifact-route';

export const RichTextDocumentEditor = () => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const { shareId, onOpenShareDocumentDialog } = useContext(
    CurrentDocumentContext
  );
  const richTextDocument = useCurrentRichTextDocument();
  const { canCommit } = useContext(CurrentArtifactVersioningContext);
  const { openCommitModal } = useContext(CommitModalContext);
  const artifact = useCurrentArtifact();
  const resolveAssetSrc = useAssetSrcResolver({ docPath: artifact.path });
  const pickAsset = useAssetInsertion();
  const peers = useRemotePresence(richTextDocument?.liveDocument ?? null);
  const participants = useMemo(
    () => uniqueParticipants(peers.map((peer) => peer.participant)),
    [peers]
  );

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <ActionsBar
          onEditorToolbarToggle={handleEditorToolbarToggle}
          isShared={shareId !== null}
          participants={participants}
          onShareClick={onOpenShareDocumentDialog}
          commitAction={{ canCommit, onCommitClick: openCommitModal }}
        />
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          {richTextDocument ? (
            <LiveRichTextDocumentEditor
              liveDocument={richTextDocument.liveDocument}
              onLocalSelectionChange={richTextDocument.onLocalSelectionChange}
              isToolbarOpen={isEditorToolbarOpen}
              assetResolution={{ pickAsset, resolveAssetSrc }}
            />
          ) : (
            <LongTextSkeleton />
          )}
        </div>
      </div>
    </div>
  );
};
