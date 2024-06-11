import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const CheckIcon = ({
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
          d="M9.6665 14.3333L4.99984 9.66667L2.6665 12L9.6665 19L21.3332 7.33333L18.9998 5L9.6665 14.3333Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
