import { IconProps } from './types';
import { DEFAULT_COLOR, DEFAULT_SIZE } from './constants';

const FormatHeading = ({
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
        <path d="M6 19V5H8V11H16V5H18V19H16V13H8V19H6Z" fill={color} />
      </g>
    </svg>
  );
};

export default FormatHeading;
