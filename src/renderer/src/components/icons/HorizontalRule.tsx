import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const HorizontalRuleIcon = ({
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
        <path d="M2 11H22V13H2V11Z" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
