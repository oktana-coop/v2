import clsx from 'clsx';
import { useContext } from 'react';

import {
  type Change,
  changeIdsAreSame,
  type Commit,
  isCommit,
  type UncommitedChange,
  urlEncodeChangeId,
} from '../../../../../../../../../modules/infrastructure/version-control';
import {
  ThemeContext,
  themes,
} from '../../../../../../../../../modules/personalization/browser';
import { TimelinePoint } from '../../../../../../../components/icons/TimelinePoint';
import { UserAvatar } from '../../../../../../../components/user/UserAvatar';

const Commit = ({
  commit,
  onClick,
  isSelected = false,
  isFirst = false,
  isLast = false,
}: {
  commit: Commit;
  onClick: (commitId: Commit['id']) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { resolvedTheme } = useContext(ThemeContext);
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="cursor-pointer text-left"
      onClick={() => onClick(commit.id)}
    >
      <div className="flex flex-row items-center">
        <div className="h-full w-14 flex-shrink-0">
          <TimelinePoint
            circleSize={7.5}
            color={resolvedTheme === themes.light ? '#9352FF' : '#C8B1FF'}
            hasTopStem={!isFirst}
            hasBottomStem={!isLast}
          />
        </div>
        <div className="flex items-center gap-2 overflow-y-hidden">
          {commit.author?.username && (
            <UserAvatar username={commit.author.username} />
          )}
          <span
            className={clsx('max-h-10 cursor-pointer text-sm', themeStyles)}
          >
            {commit.message}
          </span>
        </div>
      </div>
    </div>
  );
};

const UncommittedChange = ({
  change,
  onClick,
  isSelected = false,
  isLast = false,
}: {
  change: UncommitedChange;
  onClick: (changeId: UncommitedChange['id']) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { resolvedTheme } = useContext(ThemeContext);

  return (
    <div
      className="cursor-pointer text-left"
      key={urlEncodeChangeId(change.id)}
      onClick={() => onClick(change.id)}
    >
      <div className="flex flex-row items-center">
        <div className="h-full w-14 flex-shrink-0">
          <TimelinePoint
            color={resolvedTheme === themes.light ? '#2C2C2C' : '#fff'}
            circleSize={12.5}
            circleStrokeSize={5}
            circleFillColor="transparent"
            hasTopStem={false}
            hasBottomStem={!isLast}
          />
        </div>
        <div
          className={clsx('max-h-10 text-sm', isSelected ? 'font-bold' : '')}
        >
          Uncommited changes
        </div>
      </div>
    </div>
  );
};

export const ChangeLog = ({
  changes,
  onClick,
  selectedChange,
}: {
  changes: Array<Change>;
  onClick: (changeId: Change['id']) => void;
  selectedChange: Change['id'] | null;
}) => {
  return (
    <>
      {changes.map((change, index) => {
        return isCommit(change) ? (
          <Commit
            key={urlEncodeChangeId(change.id)}
            commit={change}
            onClick={onClick}
            isSelected={Boolean(
              selectedChange && changeIdsAreSame(selectedChange, change.id)
            )}
            isFirst={index === 0}
            isLast={changes.length - 1 === index}
          />
        ) : (
          <UncommittedChange
            key={urlEncodeChangeId(change.id)}
            change={change}
            onClick={onClick}
            isSelected={Boolean(
              selectedChange && changeIdsAreSame(selectedChange, change.id)
            )}
            isFirst={index === 0}
            isLast={changes.length === 1}
          />
        );
      })}
    </>
  );
};

export { ChangeLogSkeleton } from './ChangeLogSkeleton';
