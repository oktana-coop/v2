import { clsx } from 'clsx';
import { BranchIcon, OptionsIcon, PenIcon } from '../icons';
import { Logo } from '../brand/Logo';
import { Outlet, NavLink } from 'react-router-dom';
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
              'h-12 flex items-center justify-center relative hover:bg-zinc-950/5',
              isActive
                ? 'text-purple-500 dark:text-purple-300 before:absolute before:top-0 before:bottom-0 before:left-0 before:border-l-2 before:border-purple-500 dark:before:border-purple-300'
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
      className="flex-initial flex flex-col gap-y-5 items-center overflow-y-auto bg-transparent border-r border-gray-300 py-4 w-12 h-full"
      data-testid="nav-bar"
    >
      <NavLink to="/edit">
        <Logo />
      </NavLink>

      <nav className="self-stretch flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <NavBarItem key={item.href} item={item} />
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
