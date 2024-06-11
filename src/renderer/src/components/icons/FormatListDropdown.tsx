import { DEFAULT_SIZE as DEFAULT_HEIGHT } from './constants';
import { IconProps } from './types';

export const FormatListDropdownIcon = ({
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
        <path d="M8.1 5.5H5.5V8.1H8.1V5.5Z" fill={color ?? 'currentColor'} />
        <path d="M5.5 13.3V10.7H8.1V13.3H5.5Z" fill={color ?? 'currentColor'} />
        <path d="M5.5 15.9V18.5H8.1V15.9H5.5Z" fill={color ?? 'currentColor'} />
        <path
          d="M10.7 15.9V18.5H18.5V15.9H10.7Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M18.5 13.3V10.7H10.7V13.3H18.5Z"
          fill={color ?? 'currentColor'}
        />
        <path d="M18.5 5.5V8.1H10.7V5.5H18.5Z" fill={color ?? 'currentColor'} />
        <path
          d="M22.8333 10L22 10.8333L26.1666 15L30.3333 10.8333L29.5 10L26.1667 13.3333L22.8333 10Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
