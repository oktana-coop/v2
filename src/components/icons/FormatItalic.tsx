import { IconProps } from './types';
import { DEFAULT_COLOR, DEFAULT_SIZE } from './constants';

const FormatItalicIcon = ({
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
          d="M11.4903 5.45801H17.4903L16.7788 7.32716H14.7788L11.2212 16.6729H13.2212L12.5097 18.5421H6.5097L7.22122 16.6729H9.22122L12.7788 7.32716H10.7788L11.4903 5.45801Z"
          fill={color}
        />
      </g>
    </svg>
  );
};

export default FormatItalicIcon;
