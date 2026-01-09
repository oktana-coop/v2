import {
  isModifyDeleteConflict,
  type StructuralConflict as StructuralConflictType,
} from '../../../../../../../modules/infrastructure/version-control';
import { ModifyDeleteConflict } from './ModifyDeleteConflict';

export const StructuralConflict = ({
  conflict,
}: {
  conflict: StructuralConflictType;
}) => {
  if (isModifyDeleteConflict(conflict)) {
    return <ModifyDeleteConflict conflict={conflict} />;
  }

  return null;
};
