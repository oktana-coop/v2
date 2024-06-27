import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatHeading4Icon = ({
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
          d="M3 19V5H5V11H12V5H14V19H12V13H5V19H3Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M15.4028 19.089V17.672L19.6928 11.9H21.9028L17.7038 17.672L16.6768 17.373H23.8398V19.089H15.4028ZM20.3038 21V19.089L20.3688 17.373V15.67H22.3578V21H20.3038Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
