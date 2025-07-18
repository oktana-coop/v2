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
          d="M9.13456 9H12.1346L10 14.6075H7L9.13456 9Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M14.1346 9H17.1346L15 14.6075H12L14.1346 9Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
