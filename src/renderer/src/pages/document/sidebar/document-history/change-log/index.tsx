import clsx from 'clsx';
import { useContext } from 'react';

import {
  type Change,
  type Commit,
  commitIdsAreSame,
  isCommit,
  type UncommitedChange,
  urlEncodeCommitId,
} from '../../../../../../../modules/infrastructure/version-control';
import {
  ThemeContext,
  themes,
} from '../../../../../../../modules/personalization/browser';
import { TimelinePoint } from '../../../../../components/icons/TimelinePoint';

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
        <div className={clsx('max-h-10 cursor-pointer text-sm', themeStyles)}>
          {commit.message}
        </div>
      </div>
    </div>
  );
};

const UncommittedChange = ({
  commit,
  onClick,
  isSelected = false,
  isLast = false,
}: {
  commit: UncommitedChange;
  onClick: (commitId: Commit['id']) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { resolvedTheme } = useContext(ThemeContext);

  return (
    <div
      className="cursor-pointer text-left"
      key={urlEncodeCommitId(commit.id)}
      onClick={() => onClick(commit.id)}
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
  selectedCommit,
}: {
  changes: Array<Change>;
  onClick: (commitId: Commit['id']) => void;
  selectedCommit: Commit['id'] | null;
}) => {
  return (
    <>
      {changes.map((commit, index) => {
        return isCommit(commit) ? (
          <Commit
            key={urlEncodeCommitId(commit.id)}
            commit={commit}
            onClick={onClick}
            isSelected={Boolean(
              selectedCommit && commitIdsAreSame(selectedCommit, commit.id)
            )}
            isFirst={index === 0}
            isLast={changes.length - 1 === index}
          />
        ) : (
          <UncommittedChange
            key={urlEncodeCommitId(commit.id)}
            commit={commit}
            onClick={onClick}
            isSelected={Boolean(
              selectedCommit && commitIdsAreSame(selectedCommit, commit.id)
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
