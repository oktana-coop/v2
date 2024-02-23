import { BranchIcon, OptionsIcon, PenIcon, UserIcon } from './components/icons';

const ICON_SIZE = 32;

const navigation = [
  {
    name: 'Edit',
    href: '#',
    component: <PenIcon size={ICON_SIZE} />,
    current: true,
  },
  {
    name: 'History',
    href: '#',
    component: <BranchIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'User',
    href: '#',
    component: <UserIcon size={ICON_SIZE} />,
    current: false,
  },
  {
    name: 'Settings',
    href: '#',
    component: <OptionsIcon size={ICON_SIZE} />,
    current: false,
  },
];

export function Sidebar() {
  return (
    <div className="flex flex-col gap-y-5 items-center overflow-y-auto bg-white text-black border border-gray-300 px-4 w-14 h-full">
      <div className="flex h-14 shrink-0 items-center">
        <i className="gg-sync"></i>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col">
          {navigation.map((item) => (
            <li key={item.name} className="mb-2">
              {item.component}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
