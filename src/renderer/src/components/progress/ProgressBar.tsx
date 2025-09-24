export const ProgressBar = ({
  percentage,
  classes,
}: {
  percentage: number;
  classes?: string;
}) => {
  const perc = Math.min(1, Math.max(0, percentage));
  console.log(percentage, perc);

  return (
    <div
      className={`overflow-hidden rounded-full bg-gray-200 dark:bg-white/10 ${classes ?? ''}`}
    >
      <div
        style={{ width: `${perc * 100}%` }}
        className="h-2 bg-purple-500 dark:bg-purple-300"
      />
    </div>
  );
};
