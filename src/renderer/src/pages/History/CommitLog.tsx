import clsx from 'clsx';
import { CommitHistoryIcon } from '../../components/icons';
import { Timeliner } from '../../components/icons/Timeliner';

export type Commit = {
  hash: string;
  message: string;
  time: Date;
};

export const CommitLog = ({
  commits,
  onClick,
  selectedCommit,
}: {
  commits: Array<Commit>;
  onClick: (hash: string) => void;
  selectedCommit?: string;
}) => {
  return (
    <div className="flex-auto p-5 h-full break-words">
      <div className="flex-auto flex items-center justify-center w-full font-bold mb-5">
        <CommitHistoryIcon />
        Version History
      </div>
      {commits.map((commit, index) => (
        <Commit
          key={commit.hash}
          commit={commit}
          onClick={onClick}
          isSelected={selectedCommit === commit.hash}
          isFirst={index === 0}
          isLast={commits.length - 1 === index}
        />
      ))}
    </div>
  );
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
      className="text-left"
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
