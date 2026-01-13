import { useEffect, useState } from 'react';

import { type ProjectId } from '../../../../../../../modules/domain/project';
import { RichTextDocument } from '../../../../../../../modules/domain/rich-text';
import {
  ContentConflict as ContentConflictType,
  type MergeConflictInfo,
} from '../../../../../../../modules/infrastructure/version-control';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import { useProjectId, useSuggestContentMerge } from '../../../../../hooks';
import { ReadOnlyView } from '../../documents/main/history/ReadOnlyView';
import { SuggestedMergeInfoPanel } from './SuggestedMergeInfoPanel';

export type ContentConflictProps = {
  conflict: ContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
};

export const ContentConflict = ({
  conflict,
  mergeConflictInfo,
}: ContentConflictProps) => {
  const projectId = useProjectId();
  const [suggestedResolution, setSuggestedResolution] = useState<{
    docBefore: RichTextDocument;
    docAfter: RichTextDocument;
  } | null>(null);
  const { suggestContentMerge } = useSuggestContentMerge();

  useEffect(() => {
    const suggestMerge = async (projId: ProjectId) => {
      const { targetDocument, mergedDocument } = await suggestContentMerge({
        projectId: projId,
        documentId: conflict.artifactId,
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
      <SuggestedMergeInfoPanel />
      <ReadOnlyView {...suggestedResolution} />
    </div>
  );

  return null;
};
