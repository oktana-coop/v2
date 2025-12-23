import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const CopyIcon = ({
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
        <path d="M13 7H7V5H13V7Z" fill={color ?? 'currentColor'} />
        <path d="M13 11H7V9H13V11Z" fill={color ?? 'currentColor'} />
        <path d="M7 15H13V13H7V15Z" fill={color ?? 'currentColor'} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 19V1H17V5H21V23H7V19H3ZM15 17V3H5V17H15ZM17 7V19H9V21H19V7H17Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
