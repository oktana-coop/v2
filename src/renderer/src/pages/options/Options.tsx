import { clsx } from 'clsx';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { SidebarLayoutProvider } from '../../app-state';
import { GenericCommandPalette } from '../../components/dialogs/command-palette';
import { OptionsIcon } from '../../components/icons';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';

const tabs = [
  { name: 'General', path: 'general' },
  { name: 'Sync', path: 'sync' },
  { name: 'Appearance', path: 'appearance' },
] as const;

const getTabName = (pathname: string): string => {
  const lastSegment = pathname.split('/').pop() ?? '';
  const tab = tabs.find((t) => t.path === lastSegment);
  return tab?.name ?? '';
};

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

export const Options = () => {
  const location = useLocation();
  const tabName = getTabName(location.pathname);

  useEffect(() => {
    document.title = tabName ? `v2 | Settings / ${tabName}` : 'v2 | Settings';
  }, [tabName]);

  return (
    <>
      <SidebarLayoutProvider>
        <SidebarLayout sidebar={<SettingsSidebar />}>
          <div className="flex flex-1 flex-col overflow-hidden">
            {tabName && (
              <div className="flex flex-initial items-center justify-between px-4 py-2">
                <Breadcrumb
                  segments={[
                    { label: 'Settings', href: '/options' },
                    { label: tabName },
                  ]}
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <div className="container mx-auto my-6 max-w-2xl">
                <Outlet />
              </div>
            </div>
          </div>
        </SidebarLayout>
      </SidebarLayoutProvider>
      <GenericCommandPalette />
    </>
  );
};
