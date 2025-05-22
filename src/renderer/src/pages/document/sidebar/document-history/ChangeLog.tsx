import clsx from 'clsx';
import { useContext } from 'react';

import {
  ThemeContext,
  themes,
} from '../../../../../../modules/personalization/theme';
import {
  type Change,
  type Commit,
  encodeURLHeads,
  headsAreSame,
  isCommit,
  type UncommitedChange,
} from '../../../../../../modules/version-control';
import { TimelinePoint } from '../../../../components/icons/TimelinePoint';

const Commit = ({
  commit,
  onClick,
  isSelected = false,
  isFirst = false,
  isLast = false,
}: {
  commit: Commit;
  onClick: (heads: Commit['heads']) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { theme } = useContext(ThemeContext);
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="cursor-pointer text-left"
      onClick={() => onClick(commit.heads)}
    >
      <div className="flex flex-row items-center">
        <div className="h-full w-14 flex-shrink-0">
          <TimelinePoint
            circleSize={7.5}
            color={theme === themes.light ? '#9352FF' : '#C8B1FF'}
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
  onClick: (heads: Commit['heads']) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { theme } = useContext(ThemeContext);

  return (
    <div
      className="cursor-pointer text-left"
      key={encodeURLHeads(commit.heads)}
      onClick={() => onClick(commit.heads)}
    >
      <div className="flex flex-row items-center">
        <div className="h-full w-14 flex-shrink-0">
          <TimelinePoint
            color={theme === themes.light ? '#2C2C2C' : '#fff'}
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
  onClick: (heads: Commit['heads']) => void;
  selectedCommit: Commit['heads'] | null;
}) => {
  return (
    <>
      {changes.map((commit, index) => {
        return isCommit(commit) ? (
          <Commit
            key={encodeURLHeads(commit.heads)}
            commit={commit}
            onClick={onClick}
            isSelected={Boolean(
              selectedCommit && headsAreSame(selectedCommit, commit.heads)
            )}
            isFirst={index === 0}
            isLast={changes.length - 1 === index}
          />
        ) : (
          <UncommittedChange
            key={encodeURLHeads(commit.heads)}
            commit={commit}
            onClick={onClick}
            isSelected={Boolean(
              selectedCommit && headsAreSame(selectedCommit, commit.heads)
            )}
            isFirst={index === 0}
            isLast={changes.length === 1}
          />
        );
      })}
    </>
  );
};
