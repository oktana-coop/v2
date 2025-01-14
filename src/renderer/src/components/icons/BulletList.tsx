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
        <path d="M9 7H7V9H9V7Z" fill={color ?? 'currentColor'} />
        <path d="M7 13V11H9V13H7Z" fill={color ?? 'currentColor'} />
        <path d="M7 15V17H9V15H7Z" fill={color ?? 'currentColor'} />
        <path d="M11 15V17H17V15H11Z" fill={color ?? 'currentColor'} />
        <path d="M17 13V11H11V13H17Z" fill={color ?? 'currentColor'} />
        <path d="M17 7V9H11V7H17Z" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
