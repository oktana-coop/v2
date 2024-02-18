import classnames from 'classnames';

const navigation = [
  { name: 'Edit', href: '#', icon: 'gg-pen', current: true },
  {
    name: 'History',
    href: '#',
    icon: 'gg-git-fork',
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
        <ul role="list" className="flex flex-1 flex-col space-y-6">
          {navigation.map((item) => (
            <li key={item.name}>
              <i
                className={classnames(
                  item.current
                    ? 'bg-white text-purple-500'
                    : 'text-gray-400 hover:text-purple-500 hover:bg-purple-500',
                  `${item.icon}`
                )}
              ></i>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
