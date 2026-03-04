import { useEffect, useState } from 'react';
import { useMatch, useParams } from 'react-router';

import {
  filesystemItemTypes,
  removeExtension,
} from '../../../../../../modules/infrastructure/filesystem';
import { MergeIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import {
  type ExplorerTreeNode,
  STRUCTURAL_CONFLICTS_NODE_TYPE,
  useMergeConflictResolution,
  useNavigateToResolveConflicts,
  useProjectId,
} from '../../../../hooks';
import { TreeView } from '../../shared/explorer-tree-views/tree';
import { EmptyView } from './EmptyView';

export const MergeConflictsList = () => {
  const projectId = useProjectId();
  const [documentsList, setDocumentsList] = useState<ExplorerTreeNode[]>([]);
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
    console.log('Structural Conflicts:', structuralConflicts);
    const structuralConflictItems: ExplorerTreeNode[] =
      structuralConflicts.length > 0
        ? [
            {
              type: STRUCTURAL_CONFLICTS_NODE_TYPE,
              id: 'structural',
              name: 'File Changes',
            },
          ]
        : [];

    const compareContentConflictItems: ExplorerTreeNode[] =
      compareContentConflicts.length > 0
        ? compareContentConflicts.map((conflict) => ({
            type: filesystemItemTypes.FILE,
            id: conflict.path,
            name: removeExtension(conflict.path),
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
    console.log(id);
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
          <TreeView
            data={documentsList}
            selection={
              areStructuralConflictsSelected
                ? 'structural'
                : (compareContentPath ?? null)
            }
            onSelectItem={handleSelectDocumentConflict}
          />
        </div>
      ) : (
        <EmptyView />
      )}
    </div>
  );
};
