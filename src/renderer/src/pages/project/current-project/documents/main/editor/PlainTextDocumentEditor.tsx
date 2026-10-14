import { useContext, useMemo } from 'react';

import { uniqueParticipants } from '../../../../../../../../modules/domain/collaboration';
import {
  inferPlainTextLanguageFromExtension,
  plainTextLanguages,
} from '../../../../../../../../modules/domain/plain-text';
import { createAdapter as createYamlLinterAdapter } from '../../../../../../../../modules/domain/plain-text/adapters/yaml-linter';
import {
  CommitModalContext,
  CurrentArtifactVersioningContext,
  CurrentDocumentContext,
  useCurrentPlainTextDocument,
  useRemotePresence,
} from '../../../../../../app-state';
import { LivePlainTextDocumentEditor } from '../../../../../../components/plain-text-editing/LivePlainTextDocumentEditor';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import { PlainTextActionsBar } from '../../../../../shared/document-actions-bar';
import { useCurrentArtifact } from '../../../artifact-route';

export const PlainTextDocumentEditor = () => {
  const { shareId, onOpenShareDocumentDialog } = useContext(
    CurrentDocumentContext
  );
  const plainTextDocument = useCurrentPlainTextDocument();
  const { canCommit } = useContext(CurrentArtifactVersioningContext);
  const { openCommitModal } = useContext(CommitModalContext);
  const artifact = useCurrentArtifact();
  const language = inferPlainTextLanguageFromExtension(artifact.path);
  const linter = useMemo(
    () =>
      language === plainTextLanguages.YAML ? createYamlLinterAdapter() : null,
    [language]
  );
  const peers = useRemotePresence(plainTextDocument?.liveDocument ?? null);
  const participants = useMemo(
    () => uniqueParticipants(peers.map((peer) => peer.participant)),
    [peers]
  );

  return (
    <div className="relative flex flex-auto flex-col overflow-hidden">
      <div className="w-full">
        <PlainTextActionsBar
          isShared={shareId !== null}
          participants={participants}
          onShareClick={onOpenShareDocumentDialog}
          commitAction={{ canCommit, onCommitClick: openCommitModal }}
        />
      </div>

      <div className="flex min-h-0 w-full flex-auto flex-col">
        {plainTextDocument ? (
          <LivePlainTextDocumentEditor
            liveDocument={plainTextDocument.liveDocument}
            language={language}
            linter={linter}
          />
        ) : (
          <LongTextSkeleton />
        )}
      </div>
    </div>
  );
};
