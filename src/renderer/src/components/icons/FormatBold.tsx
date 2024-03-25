import { IconProps } from './types';
import { DEFAULT_SIZE } from './constants';

export const FormatBoldIcon = ({
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
          d="M12.946 10.7833L11.2754 12.209L13.4476 12.533C14.8919 12.7485 16 13.9957 16 15.5C16 13.8431 14.6569 12.5 13 12.5H9H8V11.5H9H11C12.6283 11.5 13.9536 10.2028 13.9988 8.58539C13.9743 9.4647 13.5724 10.2488 12.946 10.7833Z"
          stroke={color ?? 'currentColor'}
          stroke-width="2"
        />
      </g>
    </svg>
  );
};
