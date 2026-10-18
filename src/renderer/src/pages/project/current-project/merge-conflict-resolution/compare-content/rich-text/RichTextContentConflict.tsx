import { useContext, useEffect, useState } from 'react';

import {
  parseProjectRelPath,
  type ProjectId,
} from '../../../../../../../../modules/domain/project';
import { type RichTextDocument } from '../../../../../../../../modules/domain/rich-text';
import {
  ContentConflict as ContentConflictType,
  type MergeConflictInfo,
} from '../../../../../../../../modules/infrastructure/version-control';
import {
  ProjectContext,
  useAssetInsertion,
  useAssetSrcResolver,
} from '../../../../../../app-state';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import { SnapshotRichTextDocumentEditor } from '../../../../../../components/rich-text-editing/SnapshotRichTextDocumentEditor';
import { useMergeConflictResolution } from '../../use-merge-conflict-resolution';
import { SuggestedMergeInfoPanel } from './SuggestedMergeInfoPanel';

export type RichTextContentConflictProps = {
  conflict: ContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
  isEditorToolbarOpen: boolean;
  showDiff: boolean;
  onDocChange: (doc: RichTextDocument) => Promise<void>;
};

export const RichTextContentConflict = ({
  conflict,
  mergeConflictInfo,
  isEditorToolbarOpen,
  showDiff,
  onDocChange,
}: RichTextContentConflictProps) => {
  const { projectId } = useContext(ProjectContext);
  const resolveAssetSrc = useAssetSrcResolver({
    docPath: parseProjectRelPath(conflict.path),
  });
  const pickAsset = useAssetInsertion(conflict.targetArtifactId);
  const [suggestedResolution, setSuggestedResolution] = useState<{
    docBefore: RichTextDocument;
    docAfter: RichTextDocument;
  } | null>(null);
  const { suggestRichTextContentMerge } = useMergeConflictResolution();

  useEffect(() => {
    const suggestMerge = async (projId: ProjectId) => {
      const { targetDocument, mergedDocument } =
        await suggestRichTextContentMerge({
          projectId: projId,
          sourceDocumentId: conflict.sourceArtifactId,
          targetDocumentId: conflict.targetArtifactId,
          commonAncestorDocumentId: conflict.commonAncestorArtifactId,
          mergeConflictInfo,
        });

      setSuggestedResolution({
        docBefore: targetDocument,
        docAfter: mergedDocument,
      });

      onDocChange(mergedDocument);
    };

    if (projectId) {
      suggestMerge(projectId);
    }
  }, [conflict, projectId, mergeConflictInfo, suggestRichTextContentMerge]);

  if (!suggestedResolution) {
    return <LongTextSkeleton />;
  }

  return (
    <div>
      <div className="p-4">
        <SuggestedMergeInfoPanel />
      </div>
      <SnapshotRichTextDocumentEditor
        doc={suggestedResolution.docAfter}
        isToolbarOpen={isEditorToolbarOpen}
        onDocChange={onDocChange}
        assetResolution={{ pickAsset, resolveAssetSrc }}
        showDiffWith={showDiff ? suggestedResolution.docBefore : undefined}
      />
    </div>
  );

  return null;
};
