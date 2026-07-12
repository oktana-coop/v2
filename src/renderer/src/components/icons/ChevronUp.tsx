import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const ChevronUpIcon = ({
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
          d="M17.6568 16.2427L19.0711 14.8285L12 7.75739L4.92892 14.8284L6.34314 16.2426L12 10.5858L17.6568 16.2427Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
