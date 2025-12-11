import { getInitials, type Username } from '../../../../modules/auth';
import { DEFAULT_AUTHOR_NAME } from '../../../../modules/infrastructure/version-control';
import { Avatar } from './Avatar';

const getColorClass = (name: string): string => {
  const colors = [
    'bg-red-600 dark:bg-red-400 text-white dark:text-gray-900',
    'bg-red-700 dark:bg-red-300 text-white dark:text-gray-900',
    'bg-red-800 dark:bg-red-200 text-white dark:text-gray-900',

    'bg-orange-600 dark:bg-orange-400 text-white dark:text-gray-900',
    'bg-orange-700 dark:bg-orange-300 text-white dark:text-gray-900',
    'bg-orange-800 dark:bg-orange-200 text-white dark:text-gray-900',

    'bg-amber-600 dark:bg-amber-400 text-white dark:text-gray-900',
    'bg-amber-700 dark:bg-amber-300 text-white dark:text-gray-900',
    'bg-amber-800 dark:bg-amber-200 text-white dark:text-gray-900',

    'bg-yellow-600 dark:bg-yellow-400 text-white dark:text-gray-900',
    'bg-yellow-700 dark:bg-yellow-300 text-white dark:text-gray-900',
    'bg-yellow-800 dark:bg-yellow-200 text-white dark:text-gray-900',

    'bg-lime-600 dark:bg-lime-400 text-white dark:text-gray-900',
    'bg-lime-700 dark:bg-lime-300 text-white dark:text-gray-900',
    'bg-lime-800 dark:bg-lime-200 text-white dark:text-gray-900',

    'bg-green-600 dark:bg-green-400 text-white dark:text-gray-900',
    'bg-green-700 dark:bg-green-300 text-white dark:text-gray-900',
    'bg-green-800 dark:bg-green-200 text-white dark:text-gray-900',

    'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-gray-900',
    'bg-emerald-700 dark:bg-emerald-300 text-white dark:text-gray-900',
    'bg-emerald-800 dark:bg-emerald-200 text-white dark:text-gray-900',

    'bg-teal-600 dark:bg-teal-400 text-white dark:text-gray-900',
    'bg-teal-700 dark:bg-teal-300 text-white dark:text-gray-900',
    'bg-teal-800 dark:bg-teal-200 text-white dark:text-gray-900',

    'bg-cyan-600 dark:bg-cyan-400 text-white dark:text-gray-900',
    'bg-cyan-700 dark:bg-cyan-300 text-white dark:text-gray-900',
    'bg-cyan-800 dark:bg-cyan-200 text-white dark:text-gray-900',

    'bg-sky-600 dark:bg-sky-400 text-white dark:text-gray-900',
    'bg-sky-700 dark:bg-sky-300 text-white dark:text-gray-900',
    'bg-sky-800 dark:bg-sky-200 text-white dark:text-gray-900',

    'bg-blue-600 dark:bg-blue-400 text-white dark:text-gray-900',
    'bg-blue-700 dark:bg-blue-300 text-white dark:text-gray-900',
    'bg-blue-800 dark:bg-blue-200 text-white dark:text-gray-900',

    'bg-indigo-600 dark:bg-indigo-400 text-white dark:text-gray-900',
    'bg-indigo-700 dark:bg-indigo-300 text-white dark:text-gray-900',
    'bg-indigo-800 dark:bg-indigo-200 text-white dark:text-gray-900',

    'bg-violet-600 dark:bg-violet-400 text-white dark:text-gray-900',
    'bg-violet-700 dark:bg-violet-300 text-white dark:text-gray-900',
    'bg-violet-800 dark:bg-violet-200 text-white dark:text-gray-900',

    'bg-fuchsia-600 dark:bg-fuchsia-400 text-white dark:text-gray-900',
    'bg-fuchsia-700 dark:bg-fuchsia-300 text-white dark:text-gray-900',
    'bg-fuchsia-800 dark:bg-fuchsia-200 text-white dark:text-gray-900',

    'bg-pink-600 dark:bg-pink-400 text-white dark:text-gray-900',
    'bg-pink-700 dark:bg-pink-300 text-white dark:text-gray-900',
    'bg-pink-800 dark:bg-pink-200 text-white dark:text-gray-900',

    'bg-rose-600 dark:bg-rose-400 text-white dark:text-gray-900',
    'bg-rose-700 dark:bg-rose-300 text-white dark:text-gray-900',
    'bg-rose-800 dark:bg-rose-200 text-white dark:text-gray-900',
  ];

  // Creates a consistent hash for a given name
  const hash = Array.from(name).reduce(
    (acc, char) => char.charCodeAt(0) + ((acc << 5) - acc),
    0
  );

  // Picks a color index.
  // Same name always gets the same color.
  return colors[Math.abs(hash) % colors.length];
};

export const UserAvatar = ({ username }: { username: Username }) => {
  if (username === DEFAULT_AUTHOR_NAME) {
    return null;
  }

  return (
    <Avatar
      initials={getInitials(username)}
      className={`size-8 ${getColorClass(username)}`}
    />
  );
};
