import clsx from 'clsx';
import { Timeliner } from '../../components/icons/Timeliner';
import { DecodedChange } from '@automerge/automerge/next';
import { isCommit } from './isCommit';
import { default as Automerge } from '@automerge/automerge/next';

// Commit is a special type of an (automerge) change that
// strictly has a message and a time
export type Commit = {
  hash: string;
  message: string;
  time: Date;
};

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
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="text-left cursor-pointer"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="flex flex-row items-center">
        <div className="w-14 h-full flex-shrink-0">
          <Timeliner color="#a855f7" isTopOne={isFirst} isBottomOne={isLast} />
        </div>
        <div className={clsx('cursor-pointer text-sm max-h-10', themeStyles)}>
          {commit.message}
        </div>
      </div>
    </div>
  );
};

const UncommitChange = ({
  commit,
  onClick,
  isSelected = false,
  isFirst = false,
  isLast = false,
}: {
  commit: Automerge.DecodedChange;
  onClick: (hash: string) => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="text-left cursor-pointer"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="flex flex-row items-center">
        <div className="w-14 h-full flex-shrink-0">
          <Timeliner isSpecial={true} isTopOne={isFirst} isBottomOne={isLast} />
        </div>
        <div className={clsx('text-sm max-h-10', themeStyles)}>
          Uncommited change
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
          <UncommitChange
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
