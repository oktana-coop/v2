import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const FormatBoldIcon = ({
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
          d="M11 4.50452H7V19.4955H13C15.2091 19.4955 17 17.7047 17 15.4955C17 13.4917 15.5266 11.8321 13.6041 11.5409C14.4587 10.8073 15 9.71911 15 8.50452C15 6.29538 13.2091 4.50452 11 4.50452ZM9 6.50452H11C12.1046 6.50452 13 7.39995 13 8.50452C13 9.60909 12.1046 10.5045 11 10.5045H9V6.50452ZM9 17.4955V13.4955H13C14.1046 13.4955 15 14.391 15 15.4955C15 16.6001 14.1046 17.4955 13 17.4955H9Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
