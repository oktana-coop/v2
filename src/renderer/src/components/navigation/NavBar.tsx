import { clsx } from 'clsx';
import { useMemo } from 'react';
import { NavLink, useMatch } from 'react-router';

import {
  projectTypes,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { type ProjectId } from '../../../../modules/domain/project/models';
import {
  type BrowserStorageProjectData,
  MULTI_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY,
  SINGLE_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY,
} from '../../app-state/current-project/browser-storage';
import { Logo } from '../brand/Logo';
import { BranchIcon, OptionsIcon, PenIcon } from '../icons';
import { IconProps } from '../icons/types';

const ICON_SIZE = 32;

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<IconProps>;
  current: boolean;
};

const getProjectSubroute = ({
  subpath,
  fallback,
  projectId,
}: {
  subpath: string;
  fallback: string;
  projectId: ProjectId | null;
}) =>
  projectId
    ? `/projects/${urlEncodeProjectId(projectId)}/${subpath}`
    : fallback;

export const NavBarItem = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <li key={item.name} className="mb-2">
      <NavLink to={item.href} aria-label={item.name}>
        {({ isActive }) => (
          <div
            className={clsx(
              'relative flex h-12 items-center justify-center hover:bg-zinc-950/5',
              isActive
                ? 'text-purple-500 before:absolute before:bottom-0 before:left-0 before:top-0 before:border-l-2 before:border-purple-500 dark:text-purple-300 dark:before:border-purple-300'
                : 'text-black text-opacity-55 dark:text-white dark:text-opacity-55'
            )}
          >
            <Icon size={ICON_SIZE} />
          </div>
        )}
      </NavLink>
    </li>
  );
};

const getStoredProjectId = (): ProjectId | null => {
  const storageKey =
    window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? MULTI_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY
      : SINGLE_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY;

  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return (JSON.parse(stored) as BrowserStorageProjectData).projectId ?? null;
  } catch {
    return null;
  }
};

export function NavBar() {
  const projectMatch = useMatch('/projects/:projectId/*');
  const projectIdFromUrl =
    (projectMatch?.params.projectId as ProjectId | undefined) ?? null;
  const projectId = projectIdFromUrl ?? getStoredProjectId();

  const isMultiDocumentProject =
    window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT;

  const projectSpecificNavItems: NavItem[] = useMemo(
    () => [
      {
        name: 'Edit',
        href: getProjectSubroute({
          subpath: 'documents',
          fallback: '/projects',
          projectId,
        }),
        icon: PenIcon,
        current: true,
      },
      ...(isMultiDocumentProject
        ? [
            {
              name: 'History',
              href: getProjectSubroute({
                subpath: 'history',
                fallback: '/history',
                projectId,
              }),
              icon: BranchIcon,
              current: false,
            },
          ]
        : []),
    ],
    [projectId, isMultiDocumentProject]
  );

  const appWideNavItems: NavItem[] = [
    {
      name: 'Options',
      href: '/options',
      icon: OptionsIcon,
      current: false,
    },
  ];

  return (
    <div
      className="flex h-full w-12 flex-none flex-col items-center gap-y-5 overflow-y-auto border-r border-gray-300 bg-transparent py-4 dark:border-neutral-600"
      data-testid="nav-bar"
    >
      <NavLink to="/projects">
        <Logo />
      </NavLink>

      <nav className="flex flex-1 flex-col self-stretch">
        <ul role="list" className="flex flex-1 flex-col">
          {projectSpecificNavItems.map((item) => (
            <NavBarItem key={item.name} item={item} />
          ))}
          <li className={projectSpecificNavItems.length > 1 ? 'mt-auto' : ''}>
            <ul role="list">
              {appWideNavItems.map((item) => (
                <NavBarItem key={item.name} item={item} />
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
