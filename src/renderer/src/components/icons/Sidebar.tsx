import { IconProps } from './types';
import { DEFAULT_SIZE } from './constants';

export const SidebarIcon = ({
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
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21 20H7V4H21V20ZM19 18H9V6H19V18Z"
          fill={color ?? 'currentColor'}
        />
        <path d="M3 20H5V4H3V20Z" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
