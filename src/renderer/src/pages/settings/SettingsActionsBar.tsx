import { SidebarToggleButton } from '../shared/sidebar-toggle-button';

export const SettingsActionsBar = ({
  children,
}: {
  children?: React.ReactNode;
}) => (
  <div className="flex flex-initial items-center gap-2 px-4 py-2">
    <SidebarToggleButton />
    {children}
  </div>
);
