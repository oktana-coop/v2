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
      <div className="flex-auto flex items-center justify-center w-full font-bold">
        <CommitHistoryIcon />
        Version History
      </div>
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
  const themeStyles = isSelected ? 'font-bold' : '';
  return (
    <div
      className="text-left"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="flex flex-row items-center">
        <div className="w-10 h-full flex-shrink-0">
          <Timeliner color="#a855f7" />
        </div>
        <div className={clsx('cursor-pointer', themeStyles)}>
          {commit.message}
        </div>
      </div>
    </div>
  );
};
