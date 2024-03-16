import { clsx } from 'clsx';
import resolveConfig from 'tailwindcss/resolveConfig';

// @ts-ignore
import tailwindConfig from '../../../tailwind.config';
import { BranchIcon, OptionsIcon, PenIcon, UserIcon } from '../icons';
import { Logo } from '../brand/Logo';
import { Outlet, NavLink } from 'react-router-dom';

const twConfig = resolveConfig(tailwindConfig);

const ICON_SIZE = 32;

const navigation = [
  {
    name: 'Edit',
    href: '/edit',
    icon: PenIcon,
    component: <PenIcon size={ICON_SIZE} />,
    current: true,
  },
  {
    name: 'History',
    href: '/history',
    icon: BranchIcon,
    component: <BranchIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'User',
    href: '/user',
    icon: UserIcon,
    component: <UserIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: OptionsIcon,
    component: <OptionsIcon size={ICON_SIZE} />,
    current: false,
  },
];

// @ts-ignore
export const NavSidebarItem = ({ item }) => {
  const Icon = item.icon;
  return (
    <li key={item.name} className="mb-2">
      <NavLink to={item.href}>
        {({ isActive }) => (
          <div
            className={clsx(
              'h-12 flex items-center justify-center relative',
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
    <div className="flex-initial flex flex-col gap-y-5 items-center overflow-y-auto bg-transparent border-r border-gray-300 py-4 w-12 h-full">
      <NavLink to="/edit">
        <Logo />
      </NavLink>

      <nav className="self-stretch flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <NavSidebarItem item={item} />
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
