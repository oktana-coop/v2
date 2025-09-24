export const ProgressBar = ({ percentage }: { percentage: number }) => {
  const perc = Math.min(1, Math.max(0, percentage));

  return (
    <div className="overflow-hidden bg-gray-200 dark:bg-white/10">
      <div
        style={{ width: `${perc * 100}%` }}
        className="h-2 bg-purple-500 dark:bg-purple-300"
      />
    </div>
  );
};
