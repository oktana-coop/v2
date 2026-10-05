import { Outlet } from 'react-router';

import { ProseMirrorProvider } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  CloneFromGithubModalProvider,
  CommitModalProvider,
  CurrentArtifactVersioningProvider,
  CurrentDocumentProvider,
  ProjectProvider,
  ShareRegistryProvider,
  SidebarLayoutProvider,
} from '../../../app-state';

export const ProjectProviders = () => {
  return (
    <ShareRegistryProvider>
      <ProjectProvider>
        <CommitModalProvider>
          <CurrentDocumentProvider>
            <CurrentArtifactVersioningProvider>
              <CloneFromGithubModalProvider>
                <ProseMirrorProvider>
                  <SidebarLayoutProvider>
                    <Outlet />
                  </SidebarLayoutProvider>
                </ProseMirrorProvider>
              </CloneFromGithubModalProvider>
            </CurrentArtifactVersioningProvider>
          </CurrentDocumentProvider>
        </CommitModalProvider>
      </ProjectProvider>
    </ShareRegistryProvider>
  );
};
