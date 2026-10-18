import { ActionsBarTitle } from '../actions-bar-title';
import { SidebarToggleButton } from '../sidebar-toggle-button';

export const DefaultActionsBar = ({ title }: { title?: string }) => (
  <div className="flex flex-initial items-center justify-between px-4 py-2">
    <SidebarToggleButton />
    {title && <ActionsBarTitle title={title} />}
  </div>
);
