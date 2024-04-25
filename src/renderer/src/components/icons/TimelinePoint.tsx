type Props = {
  color?: string;
  circleSize?: number;
  circleFillColor?: string;
  circleStrokeColor?: string;
  circleStrokeSize?: number;
  className?: string;
  hasTopStem?: boolean;
  hasBottomStem?: boolean;
};

export const TimelinePoint = ({
  color = 'black',
  circleSize = 10,
  circleFillColor,
  circleStrokeColor,
  circleStrokeSize = 0,
  className,
  hasTopStem = true,
  hasBottomStem = true,
}: Props) => {
  const size = 100;
  const fillCircle = circleFillColor ?? color;
  const strokeColor = circleStrokeColor ?? color;
  const r = circleSize;
  const cx = size / 2;
  const cy = size / 2;
  const rectWidth = size / 20;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g>
        {hasTopStem && (
          <rect
            x={cx - rectWidth / 2}
            width={rectWidth}
            height={size / 2 - r + 1}
            fill={color}
          />
        )}
        {hasBottomStem && (
          <rect
            x={cx - rectWidth / 2}
            y={size / 2 + r - 1}
            width={rectWidth}
            height={size / 2}
            fill={color}
          />
        )}
        <circle
          stroke={strokeColor}
          strokeWidth={circleStrokeSize}
          r={r}
          cx={cx}
          cy={cy}
          fill={fillCircle}
        />
      </g>
    </svg>
  );
};
