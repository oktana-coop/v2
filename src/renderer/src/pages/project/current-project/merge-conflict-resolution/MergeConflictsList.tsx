import { useEffect, useState } from 'react';
import { useMatch, useParams } from 'react-router';

import { removeExtension } from '../../../../../../modules/infrastructure/filesystem';
import { DiffIcon, MergeIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import {
  useMergeConflictResolution,
  useNavigateToResolveConflicts,
  useProjectId,
} from '../../../../hooks';
import {
  DocumentList,
  type DocumentListItem,
} from '../../shared/document-list-views/DocumentList';
import { EmptyView } from './EmptyView';

export const MergeConflictsList = () => {
  const projectId = useProjectId();
  const [documentsList, setDocumentsList] = useState<DocumentListItem[]>([]);
  const structuralSubRouteMatch = useMatch(
    '/projects/:projectId/merge/structural'
  );
  const { compareContentPath } = useParams();
  const [areStructuralConflictsSelected, setAreStructuralConflictsSelected] =
    useState<boolean>(false);
  const { compareContentConflicts, structuralConflicts, mergeConflictInfo } =
    useMergeConflictResolution();
  const navigateToMergeConflictRoute = useNavigateToResolveConflicts();

  useEffect(() => {
    setAreStructuralConflictsSelected(Boolean(structuralSubRouteMatch));
  }, [structuralSubRouteMatch]);

  useEffect(() => {
    const structuralConflictItems: DocumentListItem[] =
      structuralConflicts.length > 0
        ? [
            {
              id: 'structural',
              name: 'File Changes',
              isSelected: areStructuralConflictsSelected,
              icon: DiffIcon,
            },
          ]
        : [];

    const compareContentConflictItems: DocumentListItem[] =
      compareContentConflicts.length > 0
        ? compareContentConflicts.map((conflict) => ({
            id: conflict.path,
            name: removeExtension(conflict.path),
            isSelected: conflict.path === compareContentPath,
          }))
        : [];

    const docList = [
      ...structuralConflictItems,
      ...compareContentConflictItems,
    ];

    setDocumentsList(docList);
  }, [
    structuralConflicts,
    compareContentConflicts,
    areStructuralConflictsSelected,
    compareContentPath,
  ]);

  const handleSelectDocumentConflict = async (id: string) => {
    if (projectId && mergeConflictInfo) {
      navigateToMergeConflictRoute({
        projectId,
        mergeConflictInfo,
        selectSubRoute: id,
      });
    }
  };

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={MergeIcon} text="Merge Conflicts" />
        </div>
      </div>

      {documentsList.length > 0 ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <DocumentList
            items={documentsList}
            onSelectItem={handleSelectDocumentConflict}
          />
        </div>
      ) : (
        <EmptyView />
      )}
    </div>
  );
};
