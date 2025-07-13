import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatQuoteIcon = ({
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
          d="M3 7.5C3 6.12 4.12 5 5.5 5S8 6.12 8 7.5 6.88 10 5.5 10c-.37 0-.71-.09-1.02-.24L3 11.5V7.5z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M13 7.5C13 6.12 14.12 5 15.5 5S18 6.12 18 7.5 16.88 10 15.5 10c-.37 0-.71-.09-1.02-.24L13 11.5V7.5z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
