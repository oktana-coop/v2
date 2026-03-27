import { useContext } from 'react';

import {
  type ChangedDocument,
  type Commit,
} from '../../../../../../../modules/infrastructure/version-control';
import {
  ThemeContext,
  themes,
} from '../../../../../../../modules/personalization/browser';
import { TimelinePoint } from '../../../../../components/icons/TimelinePoint';
import { UserAvatar } from '../../../../../components/user/UserAvatar';
import { formatCommitDate } from '../../../shared/historical-view';
import { ChangedDocumentRow } from './ChangedDocumentRow';

const ChangedDocumentSkeleton = () => (
  <div
    className="flex h-[32px] items-center py-0.5 pr-2"
    style={{ paddingLeft: 40 }}
  >
    <div className="h-4 w-4 rounded bg-gray-200 dark:bg-neutral-600" />
    <div className="ml-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-neutral-600" />
  </div>
);

const ChangedDocumentsSkeleton = () => (
  <div className="animate-pulse">
    <ChangedDocumentSkeleton />
    <ChangedDocumentSkeleton />
    <ChangedDocumentSkeleton />
  </div>
);

const CommitChangedDocuments = ({
  changedDocuments,
  loadingDocuments,
  isDocumentSelected,
  onSelectDocument,
  timelineColor,
}: {
  changedDocuments: ChangedDocument[] | undefined;
  loadingDocuments: boolean;
  isDocumentSelected: (document: ChangedDocument) => boolean;
  onSelectDocument: (document: ChangedDocument) => void;
  timelineColor: string;
}) => (
  <div className="flex">
    <div className="flex w-14 flex-shrink-0 justify-center">
      <div className="w-[3px]" style={{ backgroundColor: timelineColor }} />
    </div>
    <div className="flex-1 py-1 pr-2">
      {loadingDocuments ? (
        <ChangedDocumentsSkeleton />
      ) : changedDocuments && changedDocuments.length > 0 ? (
        <ul className="list-none">
          {changedDocuments.map((document) => (
            <ChangedDocumentRow
              key={document.path}
              file={document}
              isSelected={isDocumentSelected(document)}
              onClick={() => onSelectDocument(document)}
            />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-center text-xs text-zinc-400 dark:text-neutral-500">
          No changed files
        </p>
      )}
    </div>
  </div>
);

export const ProjectCommitRow = ({
  commit,
  isFirst,
  isLast,
  isExpanded,
  changedDocuments,
  loadingDocuments,
  isDocumentSelected,
  onToggleExpand,
  onSelectDocument,
}: {
  commit: Commit;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  changedDocuments: ChangedDocument[] | undefined;
  loadingDocuments: boolean;
  isDocumentSelected: (document: ChangedDocument) => boolean;
  onToggleExpand: () => void;
  onSelectDocument: (document: ChangedDocument) => void;
}) => {
  const { resolvedTheme } = useContext(ThemeContext);
  const timelineColor = resolvedTheme === themes.light ? '#9352FF' : '#C8B1FF';

  const firstLine = commit.message.split('\n')[0];
  const hasBottomContent =
    isExpanded &&
    (loadingDocuments || (changedDocuments && changedDocuments.length > 0));

  return (
    <div data-testid="project-commit-row">
      <div
        className="flex cursor-pointer text-left hover:bg-zinc-50 dark:hover:bg-neutral-800"
        onClick={onToggleExpand}
      >
        <div className="h-full w-14 flex-shrink-0">
          <TimelinePoint
            circleSize={7.5}
            color={timelineColor}
            hasTopStem={!isFirst}
            hasBottomStem={!isLast || !!hasBottomContent}
          />
        </div>
        <div className="flex flex-1 items-center gap-2 overflow-hidden py-1 pr-2">
          {commit.author?.username && (
            <UserAvatar username={commit.author.username} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{firstLine}</p>
            <p className="text-xs text-zinc-400 dark:text-neutral-500">
              {formatCommitDate(commit.time)}
            </p>
          </div>
        </div>
      </div>

      {isExpanded && (
        <CommitChangedDocuments
          changedDocuments={changedDocuments}
          loadingDocuments={loadingDocuments}
          isDocumentSelected={isDocumentSelected}
          onSelectDocument={onSelectDocument}
          timelineColor={timelineColor}
        />
      )}
    </div>
  );
};
