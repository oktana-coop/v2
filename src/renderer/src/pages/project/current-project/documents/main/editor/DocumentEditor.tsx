import { useCallback, useContext, useMemo, useState } from 'react';

import { uniqueParticipants } from '../../../../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  CommitModalContext,
  CurrentDocumentContext,
  SidebarLayoutContext,
  useAssetInsertion,
  useAssetSrcResolver,
  useRemotePresence,
} from '../../../../../../app-state';
import { LiveDocumentEditor } from '../../../../../../components/editing/LiveDocumentEditor';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import { ActionsBar } from '../../../../../shared/document-actions-bar';
import { useCurrentArtifact } from '../../../artifact-route';

export const DocumentEditor = () => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const {
    liveDocument,
    onLocalSelectionChange,
    canCommit,
    shareId,
    onOpenShareDocumentDialog,
  } = useContext(CurrentDocumentContext);
  const { openCommitModal } = useContext(CommitModalContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const artifact = useCurrentArtifact();
  const resolveAssetSrc = useAssetSrcResolver({ docPath: artifact.path });
  const pickAsset = useAssetInsertion();
  const peers = useRemotePresence(liveDocument);
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
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          isShared={shareId !== null}
          participants={participants}
          onShareClick={onOpenShareDocumentDialog}
          commitAction={{ canCommit, onCommitClick: openCommitModal }}
        />
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          {liveDocument ? (
            <LiveDocumentEditor
              liveDocument={liveDocument}
              onLocalSelectionChange={onLocalSelectionChange}
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
