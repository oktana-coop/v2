import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatHeading3Icon = ({
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
          d="M19.4578 21.156C18.8251 21.156 18.1968 21.0737 17.5728 20.909C16.9488 20.7357 16.4201 20.493 15.9868 20.181L16.8058 18.569C17.1525 18.8204 17.5555 19.0197 18.0148 19.167C18.4741 19.3144 18.9378 19.388 19.4058 19.388C19.9345 19.388 20.3505 19.284 20.6538 19.076C20.9572 18.868 21.1088 18.582 21.1088 18.218C21.1088 17.8714 20.9745 17.5984 20.7058 17.399C20.4372 17.1997 20.0038 17.1 19.4058 17.1H18.4438V15.709L20.9788 12.836L21.2128 13.59H16.4418V11.9H22.8118V13.265L20.2898 16.138L19.2238 15.527H19.8348C20.9528 15.527 21.7978 15.7784 22.3698 16.281C22.9418 16.7837 23.2278 17.4294 23.2278 18.218C23.2278 18.7294 23.0935 19.2104 22.8248 19.661C22.5561 20.103 22.1445 20.4627 21.5898 20.74C21.0352 21.0174 20.3245 21.156 19.4578 21.156Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
