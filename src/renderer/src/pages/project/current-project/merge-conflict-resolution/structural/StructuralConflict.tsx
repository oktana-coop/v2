import {
  isModifyDeleteConflict,
  type MergeConflictInfo,
  type StructuralConflict as StructuralConflictType,
} from '../../../../../../../modules/infrastructure/version-control';
import { UnsupportedConflict } from '../UnsupportedConflict';
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

  return (
    <UnsupportedConflict>
      v2 is not yet able to handle this conflict type. Please reach out to us
      for support.
    </UnsupportedConflict>
  );
};
