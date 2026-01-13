import {
  type CompareContentConflict as CompareContentConflictType,
  isContentConflict,
  type MergeConflictInfo,
} from '../../../../../../../modules/infrastructure/version-control';
import { ContentConflict } from './ContentConflict';

export type CompareContentConflictProps = {
  conflict: CompareContentConflictType;
  mergeConflictInfo: MergeConflictInfo;
};

export const CompareContentConflict = ({
  conflict,
  mergeConflictInfo,
}: CompareContentConflictProps) => {
  if (isContentConflict(conflict)) {
    return (
      <ContentConflict
        conflict={conflict}
        mergeConflictInfo={mergeConflictInfo}
      />
    );
  }

  // TODO: Implement AddAddConflict.
  // In this case it's probably best to ask from the user
  // to select one of the two versions instead of comparing.
  return null;
};
