import { DecodedChange } from '@automerge/automerge/next';
import { default as Automerge } from '@automerge/automerge/next';
import clsx from 'clsx';
import { useContext } from 'react';

import type { Commit } from '../../../automerge';
import { isCommit } from '../../../automerge';
import { TimelinePoint } from '../../../components/icons/TimelinePoint';
import { ThemeContext, themes } from '../../../personalization/theme';

const Commit = ({
  commit,
  onClick,
  isSelected = false,
  isFirst = false,
  isLast = false,
}: {
  commit: Commit;
  onClick: (hash: string) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { theme } = useContext(ThemeContext);
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="text-left cursor-pointer"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="flex flex-row items-center">
        <div className="w-14 h-full flex-shrink-0">
          <TimelinePoint
            circleSize={7.5}
            color={theme === themes.light ? '#9352FF' : '#C8B1FF'}
            hasTopStem={!isFirst}
            hasBottomStem={!isLast}
          />
        </div>
        <div className={clsx('cursor-pointer text-sm max-h-10', themeStyles)}>
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
}: {
  commit: Automerge.DecodedChange;
  onClick: (hash: string) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { theme } = useContext(ThemeContext);
  return (
    <div
      className="text-left cursor-pointer"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="flex flex-row items-center">
        <div className="w-14 h-full flex-shrink-0">
          <TimelinePoint
            color={theme === themes.light ? '#2C2C2C' : '#fff'}
            circleSize={12.5}
            circleStrokeSize={5}
            circleFillColor="transparent"
            hasTopStem={false}
          />
        </div>
        <div
          className={clsx('text-sm max-h-10', isSelected ? 'font-bold' : '')}
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
  changes: Array<DecodedChange | Commit>;
  onClick: (hash: string) => void;
  selectedCommit?: string;
}) => {
  return (
    <>
      {changes.map((commit, index) => {
        return isCommit(commit) ? (
          <Commit
            key={commit.hash}
            commit={commit}
            onClick={onClick}
            isSelected={selectedCommit === commit.hash}
            isFirst={index === 0}
            isLast={changes.length - 1 === index}
          />
        ) : (
          <UncommittedChange
            key={commit.hash}
            commit={commit}
            onClick={onClick}
            isSelected={selectedCommit === commit.hash}
            isFirst={index === 0}
            isLast={changes.length - 1 === index}
          />
        );
      })}
    </>
  );
};
