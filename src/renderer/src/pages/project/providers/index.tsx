import { Outlet } from 'react-router';

import { ProseMirrorProvider } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  CloneFromGithubModalProvider,
  CommitModalProvider,
  CurrentDocumentProvider,
  DocumentSharingInfoProvider,
  ProjectProvider,
  SidebarLayoutProvider,
} from '../../../app-state';

export const ProjectProviders = () => {
  return (
    <ProjectProvider>
      <CommitModalProvider>
        <DocumentSharingInfoProvider>
          <CurrentDocumentProvider>
            <CloneFromGithubModalProvider>
              <ProseMirrorProvider>
                <SidebarLayoutProvider>
                  <Outlet />
                </SidebarLayoutProvider>
              </ProseMirrorProvider>
            </CloneFromGithubModalProvider>
          </CurrentDocumentProvider>
        </DocumentSharingInfoProvider>
      </CommitModalProvider>
    </ProjectProvider>
  );
};
