import { useContext } from 'react';
import { Outlet } from 'react-router';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/browser';
import {
  CreateDocumentModalProvider,
  CurrentDocumentProvider,
  CurrentProjectProvider,
  SidebarLayoutProvider,
} from '../../../app-state';

export const ProjectProviders = () => {
  const { config } = useContext(ElectronContext);

  return (
    <CurrentProjectProvider projectType={config.projectType}>
      <CurrentDocumentProvider>
        <CreateDocumentModalProvider>
          <SidebarLayoutProvider>
            <Outlet />;
          </SidebarLayoutProvider>
        </CreateDocumentModalProvider>
      </CurrentDocumentProvider>
    </CurrentProjectProvider>
  );
};
