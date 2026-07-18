import { useContext } from 'react';

import {
  SidebarLayoutContext,
  useCurrentArtifactName,
} from '../../../../app-state';
import { UnsupportedDocument } from '../../../../components/document-views/UnsupportedDocument';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';

export const UnsupportedDocumentView = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const documentName = useCurrentArtifactName();

  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <DefaultActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
        />
      </div>
      <UnsupportedDocument fileName={documentName ?? ''} />
    </div>
  );
};
