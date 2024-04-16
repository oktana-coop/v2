import clsx from 'clsx';
import { relativeDate } from '../../utils/dates';

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
      <h2>Version history</h2>
      {commits.map((commit) => (
        <Commit
          key={commit.hash}
          commit={commit}
          onClick={onClick}
          isSelected={selectedCommit === commit.hash}
        />
      ))}
    </div>
  );
};

const Commit = ({
  commit,
  onClick,
  isSelected = false,
}: {
  commit: Commit;
  onClick: (hash: string) => void;
  isSelected?: boolean;
}) => {
  const themeStyles = isSelected ? 'border-opacity-1' : 'border-opacity-0';

  return (
    <div
      className={clsx(
        'text-left my-8 pl-2 border-l-4 border-purple-500 cursor-pointer',
        themeStyles
      )}
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="font-bold">{commit.message}</div>
      {`You saved this at `}
      <span className="italic">{relativeDate(commit.time)}</span>
    </div>
  );
};
