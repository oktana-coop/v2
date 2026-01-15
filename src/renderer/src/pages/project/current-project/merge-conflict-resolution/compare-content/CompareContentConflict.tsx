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
};

export const CompareContentConflict = ({
  conflict,
  mergeConflictInfo,
  isEditorToolbarOpen,
}: CompareContentConflictProps) => {
  if (isContentConflict(conflict)) {
    return (
      <ContentConflict
        conflict={conflict}
        mergeConflictInfo={mergeConflictInfo}
        isEditorToolbarOpen={isEditorToolbarOpen}
      />
    );
  }

  // TODO: Implement AddAddConflict.
  // In this case it's probably best to ask from the user
  // to select one of the two versions instead of comparing.
  return null;
};
