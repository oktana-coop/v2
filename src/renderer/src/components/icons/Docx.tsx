import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const DocxIcon = ({
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
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 5C3 3.34315 4.34315 2 6 2H14C17.866 2 21 5.13401 21 9V19C21 20.6569 19.6569 22 18 22H6C4.34315 22 3 20.6569 3 19V5ZM13 4H6C5.44772 4 5 4.44772 5 5V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V9H13V4ZM18.584 7C17.9413 5.52906 16.6113 4.4271 15 4.10002V7H18.584Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M9.00778 18L7.17578 12.4H8.51978L10.1118 17.36H9.43978L11.1038 12.4H12.3038L13.9038 17.36H13.2558L14.8878 12.4H16.1278L14.2958 18H12.9038L11.4878 13.648H11.8558L10.3998 18H9.00778Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
