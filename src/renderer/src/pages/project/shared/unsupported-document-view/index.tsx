import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../app-state';
import { UnsupportedDocument } from '../../../../components/document-views/UnsupportedDocument';
import { useCurrentDocumentName } from '../../../../hooks/use-current-document-name';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';

export const UnsupportedDocumentView = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const documentName = useCurrentDocumentName();

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
