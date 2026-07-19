import { useContext } from 'react';

import {
  getArtifactName,
  type ProjectRelPath,
} from '../../../../../../modules/domain/project';
import { SidebarLayoutContext } from '../../../../app-state';
import { UnsupportedDocument } from '../../../../components/document-views/UnsupportedDocument';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';

export const UnsupportedDocumentView = ({ path }: { path: ProjectRelPath }) => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <DefaultActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
        />
      </div>
      <UnsupportedDocument fileName={getArtifactName(path)} />
    </div>
  );
};
