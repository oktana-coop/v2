import { IconProps } from './types';
import { DEFAULT_SIZE as DEFAULT_HEIGHT } from './constants';

export const FormatHeadingDropdownIcon = ({
  color,
  size: height = DEFAULT_HEIGHT, // height in this case
  className,
}: IconProps) => {
  const scale = height / DEFAULT_HEIGHT;
  const widthHeightRatio = 32 / 24;
  const width = widthHeightRatio * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform={`scale(${scale})`}>
        <path
          d="M6 19V5H8V11H16V5H18V19H16V13H8V19H6Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M22.8333 10L22 10.8333L26.1666 15L30.3333 10.8333L29.5 10L26.1667 13.3333L22.8333 10Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
