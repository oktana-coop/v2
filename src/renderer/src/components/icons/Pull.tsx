import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const PullIcon = ({
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
          d="M11.0001 1H13.0001V15.4853L16.2428 12.2427L17.657 13.6569L12.0001 19.3137L6.34326 13.6569L7.75748 12.2427L11.0001 15.4853V1Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M18 20.2877H6V22.2877H18V20.2877Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
