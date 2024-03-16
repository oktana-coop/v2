import { BranchIcon, OptionsIcon, PenIcon, UserIcon } from './components/icons';
import { Logo } from './components/brand/Logo';
import { Outlet, Link } from 'react-router-dom';

const ICON_SIZE = 32;

const navigation = [
  {
    name: 'Edit',
    href: '/edit',
    component: <PenIcon size={ICON_SIZE} />,
    current: true,
  },
  {
    name: 'History',
    href: '/history',
    component: <BranchIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'User',
    href: '/user',
    component: <UserIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'Settings',
    href: '/settings',
    component: <OptionsIcon size={ICON_SIZE} />,
    current: false,
  },
];

export function Sidebar() {
  return (
    <div className="flex flex-col gap-y-5 items-center overflow-y-auto bg-transparent border-r border-gray-300 py-4 w-12 h-full">
      <Link to="/edit">
        <Logo />
      </Link>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <li key={item.name} className="mb-2">
              <Link to={item.href}>{item.component}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
