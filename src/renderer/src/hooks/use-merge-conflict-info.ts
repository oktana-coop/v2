import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  type CompareContentConflict,
  isCompareContentConflict,
  isStructuralConflict,
  type MergeConflictInfo,
  type StructuralConflict,
} from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useMergeConflictInfo = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { mergeConflictInfo: multiDocumentProjectMergeConflictInfo } =
    useContext(MultiDocumentProjectContext);

  const { mergeConflictInfo: singleDocumentProjectMergeConflictInfo } =
    useContext(SingleDocumentProjectContext);

  const [mergeConflictInfo, setMergeConflictInfo] =
    useState<MergeConflictInfo | null>(null);
  const [structuralConflicts, setStructuralConflicts] = useState<
    StructuralConflict[]
  >([]);
  const [compareContentConflicts, setCompareContentConflicts] = useState<
    CompareContentConflict[]
  >([]);

  useEffect(() => {
    const conflictInfo =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectMergeConflictInfo
        : singleDocumentProjectMergeConflictInfo;

    if (conflictInfo) {
      const structuralConflicts = conflictInfo.conflicts.filter((conflict) =>
        isStructuralConflict(conflict)
      );
      const compareContentConflicts = conflictInfo.conflicts.filter(
        (conflict) => isCompareContentConflict(conflict)
      );
      setStructuralConflicts(structuralConflicts);
      setCompareContentConflicts(compareContentConflicts);
    } else {
      setStructuralConflicts([]);
      setCompareContentConflicts([]);
    }

    setMergeConflictInfo(conflictInfo);
  }, [
    multiDocumentProjectMergeConflictInfo,
    singleDocumentProjectMergeConflictInfo,
    projectType,
  ]);

  return {
    mergeConflictInfo,
    structuralConflicts,
    compareContentConflicts,
  };
};
