type Props = {
  size?: number;
  color?: string;
  className?: string;
  isTopOne?: boolean;
  isBottomOne?: boolean;
  isSpecial?: boolean;
};

export const Timeliner = ({
  size = 100,
  color = 'black',
  className,
  isTopOne = false,
  isBottomOne = false,
  isSpecial = false,
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
        {!isTopOne && (
          <rect
            x={cx - rectWidth / 2}
            width={rectWidth}
            height={size / 2 - r}
            fill={color ?? 'currentColor'}
          />
        )}
        {!isBottomOne && (
          <rect
            x={cx - rectWidth / 2}
            y={size / 2 + r}
            width={rectWidth}
            height={size / 2}
            fill={color ?? 'currentColor'}
          />
        )}
        {isSpecial ? (
          <circle
            stroke="rgba(0,0,0,1)"
            fill="rgba(0,0,0,0)"
            strokeWidth={rectWidth}
            r={r * 1.2}
            cx={cx}
            cy={cy}
          />
        ) : (
          <circle
            stroke="currentcolor"
            strokeWidth={0}
            r={r}
            cx={cx}
            cy={cy}
            fill={color ?? 'currentColor'}
          />
        )}
      </g>
    </svg>
  );
};
