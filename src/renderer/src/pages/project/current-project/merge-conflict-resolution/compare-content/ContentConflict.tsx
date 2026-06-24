import { useContext, useEffect, useState } from 'react';

import { type ProjectId } from '../../../../../../../modules/domain/project';
import { type RichTextDocument } from '../../../../../../../modules/domain/rich-text';
import {
  ContentConflict as ContentConflictType,
  type MergeConflictInfo,
} from '../../../../../../../modules/infrastructure/version-control';
import { ProjectContext } from '../../../../../app-state';
import { RichTextEditor } from '../../../../../components/editing/RichTextEditor';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import {
  useAssetInsertion,
  useAssetSrcResolver,
  useMergeConflictResolution,
} from '../../../../../hooks';
import { SuggestedMergeInfoPanel } from './SuggestedMergeInfoPanel';

export type ContentConflictProps = {
  conflict: ContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
  isEditorToolbarOpen: boolean;
  showDiff: boolean;
  onDocChange: (doc: RichTextDocument) => Promise<void>;
};

export const ContentConflict = ({
  conflict,
  mergeConflictInfo,
  isEditorToolbarOpen,
  showDiff,
  onDocChange,
}: ContentConflictProps) => {
  const { projectId } = useContext(ProjectContext);
  const resolveAssetSrc = useAssetSrcResolver(conflict.path);
  const pickAsset = useAssetInsertion(conflict.path);
  const [suggestedResolution, setSuggestedResolution] = useState<{
    docBefore: RichTextDocument;
    docAfter: RichTextDocument;
  } | null>(null);
  const { suggestContentMerge } = useMergeConflictResolution();

  useEffect(() => {
    const suggestMerge = async (projId: ProjectId) => {
      const { targetDocument, mergedDocument } = await suggestContentMerge({
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
  }, [conflict, projectId, mergeConflictInfo, suggestContentMerge]);

  if (!suggestedResolution) {
    return <LongTextSkeleton />;
  }

  return (
    <div>
      <div className="p-4">
        <SuggestedMergeInfoPanel />
      </div>
      <RichTextEditor
        doc={suggestedResolution.docAfter}
        isToolbarOpen={isEditorToolbarOpen}
        onDocChange={onDocChange}
        pickAsset={pickAsset}
        showDiffWith={showDiff ? suggestedResolution.docBefore : undefined}
        resolveAssetSrc={resolveAssetSrc}
      />
    </div>
  );

  return null;
};
