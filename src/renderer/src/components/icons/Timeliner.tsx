type Props = {
  size?: number;
  color?: string;
  className?: string;
};

export const Timeliner = ({
  size = 100,
  color = 'black',
  className,
}: Props) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 10;
  const rectWidth = size / 20;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g color="purple">
        <rect
          x={cx - rectWidth / 2}
          width={rectWidth}
          height={size}
          fill={color ?? 'currentColor'}
        />
        <circle r={r} cx={cx} cy={cy} fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
