import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const MarkdownIcon = ({
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
          d="M2 17.2V6H3.712L8.608 14.176H7.712L12.528 6H14.24L14.256 17.2H12.288L12.272 9.088H12.688L8.592 15.92H7.664L3.504 9.088H3.984V17.2H2Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M19.0754 6.19995L20.3962 6.19995L20.3962 14.6716L22.5375 12.5303L23.4714 13.4642L19.7357 17.2L16 13.4642L16.9339 12.5303L19.0754 14.6718L19.0754 6.19995Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
