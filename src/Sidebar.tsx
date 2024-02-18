export function Sidebar() {
  return (
    <div className="flex flex-col gap-y-5 overflow-y-auto bg-white text-black border border-gray-400 px-4 w-20 h-full">
      <div className="flex h-14 shrink-0 items-center">LOGO</div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-4">
              <li key="edit">EDIT</li>
              <li key="history">HISTORY</li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
