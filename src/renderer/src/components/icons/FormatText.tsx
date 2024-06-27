import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatTextIcon = ({
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
        <path d="M11 7H5V5H19V7H13V18H11V7Z" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
