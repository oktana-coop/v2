import { useContext } from 'react';
import { Outlet } from 'react-router';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/electron-context';
import {
  CurrentDocumentProvider,
  CurrentProjectProvider,
  SidebarLayoutProvider,
} from '../../../app-state';

export const ProjectProviders = () => {
  const { config } = useContext(ElectronContext);

  return (
    <CurrentProjectProvider projectType={config.projectType}>
      <CurrentDocumentProvider>
        <SidebarLayoutProvider>
          <Outlet />;
        </SidebarLayoutProvider>
      </CurrentDocumentProvider>
    </CurrentProjectProvider>
  );
};
