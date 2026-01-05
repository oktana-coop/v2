import { useContext } from 'react';
import { Outlet } from 'react-router';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/browser';
import {
  CloneFromGithubModalProvider,
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
        <CloneFromGithubModalProvider>
          <CreateDocumentModalProvider>
            <SidebarLayoutProvider>
              <Outlet />;
            </SidebarLayoutProvider>
          </CreateDocumentModalProvider>
        </CloneFromGithubModalProvider>
      </CurrentDocumentProvider>
    </CurrentProjectProvider>
  );
};
