import { clsx } from 'clsx';
import { NavLink, Outlet } from 'react-router';

import { SidebarLayoutProvider } from '../../app-state';
import { GenericCommandPalette } from '../../components/dialogs/command-palette';
import { OptionsIcon } from '../../components/icons';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';

const tabs = [
  { name: 'General', path: 'general' },
  { name: 'Sync', path: 'sync' },
  { name: 'Appearance', path: 'appearance' },
  { name: 'Exports', path: 'exports' },
] as const;

const SettingsSidebar = () => (
  <div className="py-4">
    <div className="px-4">
      <SidebarHeading icon={OptionsIcon} text="Settings" />
    </div>
    <nav className="mt-4 flex flex-col">
      {tabs.map((tab) => (
        <NavLink key={tab.path} to={tab.path} className="w-full">
          {({ isActive }) => (
            <div
              className={clsx(
                'flex h-[32px] w-full items-center px-4 text-sm',
                isActive
                  ? 'bg-purple-50 dark:bg-neutral-600'
                  : 'hover:bg-zinc-950/5 dark:hover:bg-white/5'
              )}
            >
              {tab.name}
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  </div>
);

export const Settings = () => (
  <>
    <SidebarLayoutProvider>
      <SidebarLayout sidebar={<SettingsSidebar />}>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </SidebarLayout>
    </SidebarLayoutProvider>
    <GenericCommandPalette />
  </>
);
