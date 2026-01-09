import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const DiffIcon = ({
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
        <rect
          x="8"
          y="17"
          width="8"
          height="2"
          color={color ?? 'currentColor'}
        />
        <path d="M8 8H16V10H8V8Z" color={color ?? 'currentColor'} />
        <path d="M11 13V5H13V13H11Z" color={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
