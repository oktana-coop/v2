import { Outlet } from 'react-router';

import { ProseMirrorProvider } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  GuestEditingProvider,
  SidebarLayoutProvider,
} from '../../../app-state';

export const SharedDocumentsProviders = () => (
  <GuestEditingProvider>
    <ProseMirrorProvider>
      <SidebarLayoutProvider>
        <Outlet />
      </SidebarLayoutProvider>
    </ProseMirrorProvider>
  </GuestEditingProvider>
);
