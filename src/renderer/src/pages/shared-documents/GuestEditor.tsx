import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { uniqueParticipants } from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  GuestEditingContext,
  SidebarLayoutContext,
  useRemotePresence,
} from '../../app-state';
import { LiveDocumentEditor } from '../../components/editing/LiveDocumentEditor';
import { LongTextSkeleton } from '../../components/progress/skeletons/LongText';
import { ActionsBar } from '../shared/document-actions-bar';

export const GuestEditor = () => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const { liveDocument, name, onLocalSelectionChange, onOpenSharingDialog } =
    useContext(GuestEditingContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const peers = useRemotePresence(liveDocument);
  const participants = useMemo(
    () => uniqueParticipants(peers.map((peer) => peer.participant)),
    [peers]
  );

  useEffect(() => {
    window.document.title = name ? `v2 | ${name}` : 'v2 | Shared with me';
  }, [name]);

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
          isShared
          participants={participants}
          onShareClick={onOpenSharingDialog}
          commitAction={null}
        />
      </div>
      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          {liveDocument ? (
            <LiveDocumentEditor
              liveDocument={liveDocument}
              onLocalSelectionChange={onLocalSelectionChange}
              isToolbarOpen={isEditorToolbarOpen}
              assetResolution={null}
            />
          ) : (
            <LongTextSkeleton />
          )}
        </div>
      </div>
    </div>
  );
};
