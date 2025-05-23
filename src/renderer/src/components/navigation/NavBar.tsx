import { clsx } from 'clsx';
import { NavLink } from 'react-router';

import { Logo } from '../brand/Logo';
import { BranchIcon, OptionsIcon, PenIcon } from '../icons';
import { IconProps } from '../icons/types';

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
    href: '/documents',
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
    name: 'Options',
    href: '/options',
    icon: OptionsIcon,
    current: false,
  },
];

export const NavBarItem = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <li key={item.name} className="mb-2">
      <NavLink to={item.href}>
        {({ isActive }) => (
          <div
            className={clsx(
              'relative flex h-12 items-center justify-center hover:bg-zinc-950/5',
              isActive
                ? 'text-purple-500 before:absolute before:bottom-0 before:left-0 before:top-0 before:border-l-2 before:border-purple-500 dark:text-purple-300 dark:before:border-purple-300'
                : 'text-black text-opacity-55 dark:text-white dark:text-opacity-55'
            )}
          >
            <Icon size={ICON_SIZE} />
          </div>
        )}
      </NavLink>
    </li>
  );
};

export function NavBar() {
  return (
    <div
      className="flex h-full w-12 flex-none flex-col items-center gap-y-5 overflow-y-auto border-r border-gray-300 bg-transparent py-4 dark:border-neutral-600"
      data-testid="nav-bar"
    >
      <NavLink to="/documents">
        <Logo />
      </NavLink>

      <nav className="flex flex-1 flex-col self-stretch">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <NavBarItem key={item.href} item={item} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
