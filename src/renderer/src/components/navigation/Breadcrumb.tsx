import { clsx } from 'clsx';
import { Link } from 'react-router';

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  segments: BreadcrumbSegment[];
};

const Separator = () => (
  <span className="text-gray-400 dark:text-gray-500"> / </span>
);

export const Breadcrumb = ({ segments }: BreadcrumbProps) => (
  <nav className="text-sm">
    {segments.map((segment, index) => {
      const isLast = index === segments.length - 1;
      return (
        <span key={segment.label}>
          {index > 0 && <Separator />}
          {segment.href && !isLast ? (
            <Link
              to={segment.href}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {segment.label}
            </Link>
          ) : (
            <span
              className={clsx(
                isLast
                  ? 'font-semibold text-black dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {segment.label}
            </span>
          )}
        </span>
      );
    })}
  </nav>
);
