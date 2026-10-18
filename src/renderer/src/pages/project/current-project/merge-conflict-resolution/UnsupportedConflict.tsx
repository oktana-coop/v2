export const UnsupportedConflict = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-4 bg-red-50 p-4 text-left dark:bg-red-400/10">
    {children}
  </div>
);
