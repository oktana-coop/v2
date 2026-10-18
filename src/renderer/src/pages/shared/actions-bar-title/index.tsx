export const ActionsBarTitle = ({ title }: { title: string }) => (
  <div className="flex min-w-0 flex-auto items-center px-4">
    <h2 className="truncate text-left text-base/7" title={title}>
      {title}
    </h2>
  </div>
);
