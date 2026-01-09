import {
  isModifyDeleteConflict,
  type MergeConflictInfo,
  type StructuralConflict as StructuralConflictType,
} from '../../../../../../../modules/infrastructure/version-control';
import { ModifyDeleteConflict } from './ModifyDeleteConflict';

export const StructuralConflict = ({
  conflict,
  mergeConflictInfo,
}: {
  conflict: StructuralConflictType;
  mergeConflictInfo: MergeConflictInfo;
}) => {
  if (isModifyDeleteConflict(conflict)) {
    return (
      <ModifyDeleteConflict
        conflict={conflict}
        mergeConflictInfo={mergeConflictInfo}
      />
    );
  }

  return null;
};
