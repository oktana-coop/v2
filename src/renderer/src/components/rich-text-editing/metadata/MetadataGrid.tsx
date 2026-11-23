import { type ReactNode } from 'react';

export const MetadataGrid = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-[fit-content(12rem)_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm/6">
    {children}
  </dl>
);

export const MetadataGridRow = ({
  term,
  children,
}: {
  term: ReactNode;
  children: ReactNode;
}) => (
  <>
    <dt className="truncate text-zinc-600 dark:text-zinc-300">{term}</dt>
    <dd className="min-w-0 break-words text-zinc-950 dark:text-white">
      {children}
    </dd>
  </>
);
