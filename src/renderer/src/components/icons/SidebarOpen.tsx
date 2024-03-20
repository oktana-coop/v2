import { IconProps } from './types';
import { DEFAULT_SIZE } from './constants';

export const SidebarOpenIcon = ({
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
          d="M3 4H21V20H3V4ZM9 6H19V18H9V6Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
