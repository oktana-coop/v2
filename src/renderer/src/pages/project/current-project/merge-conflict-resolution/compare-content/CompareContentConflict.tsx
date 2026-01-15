import {
  type CompareContentConflict as CompareContentConflictType,
  isContentConflict,
  type MergeConflictInfo,
} from '../../../../../../../modules/infrastructure/version-control';
import { ContentConflict } from './ContentConflict';

export type CompareContentConflictProps = {
  conflict: CompareContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
  isEditorToolbarOpen: boolean;
  showDiff: boolean;
};

export const CompareContentConflict = ({
  conflict,
  mergeConflictInfo,
  isEditorToolbarOpen,
  showDiff,
}: CompareContentConflictProps) => {
  if (isContentConflict(conflict)) {
    return (
      <ContentConflict
        conflict={conflict}
        mergeConflictInfo={mergeConflictInfo}
        isEditorToolbarOpen={isEditorToolbarOpen}
        showDiff={showDiff}
      />
    );
  }

  // TODO: Implement AddAddConflict.
  // In this case it's probably best to ask from the user
  // to select one of the two versions instead of comparing.
  return null;
};
