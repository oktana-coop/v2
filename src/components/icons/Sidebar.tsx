import { IconProps } from './types';
import { DEFAULT_COLOR, DEFAULT_SIZE } from './constants';

const SidebarIcon = ({
  color = DEFAULT_COLOR,
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
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M21 20H7V4H21V20ZM19 18H9V6H19V18Z"
          fill={color}
        />
        <path d="M3 20H5V4H3V20Z" fill={color} />
      </g>
    </svg>
  );
};

export default SidebarIcon;
