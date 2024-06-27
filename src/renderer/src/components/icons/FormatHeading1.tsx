import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatHeading1Icon = ({
  color,
  size = DEFAULT_SIZE,
  className,
}: IconProps) => {
  const scale = size / DEFAULT_SIZE;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform={`scale(${scale})`}>
        <path
          d="M3 19V5H5V11H12V5H14V19H12V13H5V19H3Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M17.9108 21V12.68L18.8208 13.59H16.0908V11.9H20.0168V21H17.9108Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
