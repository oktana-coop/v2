import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const LineHeightIcon = ({
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
        <path d="M21 5V3H3V5H21Z" fill={color ?? 'currentColor'} />
        <path d="M21 19V21H3V19H21Z" fill={color ?? 'currentColor'} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.0001 7.37636C11.602 7.35207 11.2112 7.56874 11.0325 7.95204L7.65154 15.2025C7.41815 15.7031 7.6347 16.2981 8.13522 16.5315C8.63577 16.7649 9.23074 16.5484 9.46417 16.0477L9.95278 14.9999H14.0473L14.5359 16.0477C14.7693 16.5484 15.3643 16.7649 15.8648 16.5315C16.3654 16.2981 16.5819 15.7031 16.3485 15.2025L12.9676 7.95204C12.7888 7.56874 12.3981 7.35207 12.0001 7.37636ZM13.1147 12.9999H10.8854L12.0001 10.6095L13.1147 12.9999Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
