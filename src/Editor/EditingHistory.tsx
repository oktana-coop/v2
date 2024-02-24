import { relativeDate } from '../utils/dates';

export type Commit = {
  hash: string;
  message: string;
  time: Date;
};

export const EditingHistory = ({
  commits,
  onClick,
}: {
  commits: Array<Commit>;
  onClick: (hash: string) => void;
}) => {
  return (
    <div className="flex-auto w-32 p-5 h-full break-words text-black bg-white">
      <div>
        <h1>Change history</h1>
        {commits.map((commit) => (
          <Commit commit={commit} onClick={onClick} />
        ))}
      </div>
    </div>
  );
};

const Commit = ({
  commit,
  onClick,
}: {
  commit: Commit;
  onClick: (hash: string) => void;
}) => {
  return (
    <div
      className="text-left my-8"
      key={commit.hash}
      onClick={() => onClick(commit.hash)}
    >
      <div className="font-bold">{commit.message}</div>
      You saved this
      <span className="italic">{relativeDate(commit.time)}</span>
    </div>
  );
};
