import { clsx } from 'clsx';
import resolveConfig from 'tailwindcss/resolveConfig';

import tailwindConfig from '../../../tailwind.config';
import { BranchIcon, OptionsIcon, PenIcon, UserIcon } from '../icons';
import { Logo } from '../brand/Logo';
import { Outlet, NavLink } from 'react-router-dom';
import { IconProps } from '../icons/types';

const twConfig = resolveConfig(tailwindConfig);

const ICON_SIZE = 32;

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<IconProps>;
  current: boolean;
};

const navigation: NavItem[] = [
  {
    name: 'Edit',
    href: '/edit',
    icon: PenIcon,
    current: true,
  },
  {
    name: 'History',
    href: '/history',
    icon: BranchIcon,
    current: false,
  },
  {
    name: 'User',
    href: '/user',
    icon: UserIcon,
    current: false,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: OptionsIcon,
    current: false,
  },
];

export const NavSidebarItem = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <li key={item.name} className="mb-2">
      <NavLink to={item.href}>
        {({ isActive }) => (
          <div
            className={clsx(
              'h-12 flex items-center justify-center relative hover:bg-zinc-950/5',
              isActive
                ? 'before:absolute before:top-0 before:bottom-0 before:left-0 before:border-l-2 before:border-purple-500'
                : ''
            )}
          >
            <Icon
              size={ICON_SIZE}
              color={
                isActive
                  ? twConfig.theme.colors.purple[500]
                  : 'rgba(0,0,0,0.55)'
              }
            />
          </div>
        )}
      </NavLink>
    </li>
  );
};

export function NavSidebar() {
  return (
    <div
      className="flex-initial flex flex-col gap-y-5 items-center overflow-y-auto bg-transparent border-r border-gray-300 py-4 w-12 h-full"
      data-testid="nav-sidebar"
    >
      <NavLink to="/edit">
        <Logo />
      </NavLink>

      <nav className="self-stretch flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <NavSidebarItem key={item.href} item={item} />
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
