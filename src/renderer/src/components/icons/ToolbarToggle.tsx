import { DEFAULT_SIZE as DEFAULT_HEIGHT } from './constants';
import { IconProps } from './types';

export const ToolbarToggleIcon = ({
  color,
  size: height = DEFAULT_HEIGHT, // height in this case
  className,
}: IconProps) => {
  const scale = height / DEFAULT_HEIGHT;
  const widthHeightRatio = 56 / 24;
  const width = widthHeightRatio * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform={`scale(${scale})`}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.7356 4H9V18H14.6034C16.6664 18 18.3389 16.3275 18.3389 14.2644C18.3389 12.3931 16.9629 10.8432 15.1675 10.5712C15.9656 9.88608 16.4711 8.86987 16.4711 7.73557C16.4711 5.67247 14.7987 4 12.7356 4ZM10.8678 5.86778H12.7356C13.7671 5.86778 14.6034 6.70402 14.6034 7.73557C14.6034 8.76712 13.7671 9.60335 12.7356 9.60335H10.8678V5.86778ZM10.8678 16.1322V12.3966H14.6034C15.6349 12.3966 16.4711 13.2329 16.4711 14.2644C16.4711 15.296 15.6349 16.1322 14.6034 16.1322H10.8678Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M26.3293 4H32.7493L31.988 6H29.848L26.0413 16H28.1813L27.42 18H21L21.7613 16H23.9013L27.708 6H25.568L26.3293 4Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M36 10V4H38V10C38 12.2091 39.7909 14 42 14C44.2091 14 46 12.2091 46 10V4H48V10C48 13.3137 45.3137 16 42 16C38.6863 16 36 13.3137 36 10Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M37 18C36.4477 18 36 18.4477 36 19C36 19.5523 36.4477 20 37 20H47C47.5523 20 48 19.5523 48 19C48 18.4477 47.5523 18 47 18H37Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
