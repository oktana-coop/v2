import { IconProps } from './types';
import { DEFAULT_COLOR, DEFAULT_SIZE } from './constants';

export const RevertIcon = ({
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
          d="M10.6276 14.7219L9.21641 16.1391L2.83875 9.78892L9.18897 3.41125L10.6062 4.82242L6.82971 8.61526L17.1353 8.59304C19.3445 8.58828 21.1392 10.3753 21.144 12.5844L21.1612 20.5844L19.1612 20.5887L19.144 12.5887C19.1416 11.4841 18.2442 10.5907 17.1396 10.593L6.50391 10.616L10.6276 14.7219Z"
          fill={color}
        />
      </g>
    </svg>
  );
};
