import { useEffect, useState } from 'react';

import { type ProjectId } from '../../../../../../../modules/domain/project';
import { RichTextDocument } from '../../../../../../../modules/domain/rich-text';
import {
  ContentConflict as ContentConflictType,
  type MergeConflictInfo,
} from '../../../../../../../modules/infrastructure/version-control';
import { RichTextEditor } from '../../../../../components/editing/RichTextEditor';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import { useMergeConflictResolution, useProjectId } from '../../../../../hooks';
import { SuggestedMergeInfoPanel } from './SuggestedMergeInfoPanel';

export type ContentConflictProps = {
  conflict: ContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
  isEditorToolbarOpen: boolean;
  showDiff: boolean;
};

export const ContentConflict = ({
  conflict,
  mergeConflictInfo,
  isEditorToolbarOpen,
  showDiff,
}: ContentConflictProps) => {
  const projectId = useProjectId();
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
        docHandle={null}
        isToolbarOpen={isEditorToolbarOpen}
        onDocChange={async () => {}}
        showDiffWith={showDiff ? suggestedResolution.docBefore : undefined}
      />
    </div>
  );

  return null;
};
