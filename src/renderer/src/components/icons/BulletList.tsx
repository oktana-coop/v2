import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const BulletListIcon = ({
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
        <path d="M8 5H5V8H8V5Z" fill={color ?? 'currentColor'} />
        <path d="M5 13V10H8V13H5Z" fill={color ?? 'currentColor'} />
        <path d="M5 15V18H8V15H5Z" fill={color ?? 'currentColor'} />
        <path d="M10 15V18H19V15H10Z" fill={color ?? 'currentColor'} />
        <path d="M19 13V10H10V13H19Z" fill={color ?? 'currentColor'} />
        <path d="M19 5V8H10V5H19Z" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
