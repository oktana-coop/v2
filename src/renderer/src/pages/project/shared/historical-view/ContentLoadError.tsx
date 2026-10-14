export const ContentLoadError = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center p-8 text-zinc-400 dark:text-neutral-500">
    <p className="text-sm">{message}</p>
  </div>
);
