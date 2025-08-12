import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

export const RestoreCommitIcon = ({
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
          d="M5.33936 4.46783H7.33936V7.02493C8.52937 6.08984 10.03 5.53214 11.6608 5.53214C15.5268 5.53214 18.6608 8.66614 18.6608 12.5321C18.6608 16.3981 15.5268 19.5321 11.6608 19.5321C9.51031 19.5321 7.58632 18.5624 6.30225 17.0364L7.92157 15.8516C8.83747 16.8826 10.1733 17.5321 11.6608 17.5321C14.4222 17.5321 16.6608 15.2936 16.6608 12.5321C16.6608 9.77071 14.4222 7.53214 11.6608 7.53214C10.574 7.53214 9.56811 7.8789 8.74785 8.46783L11.3394 8.46783V10.4678H5.33936V4.46783Z"
          fill={color ?? 'currentColor'}
        />
        <circle cx="3.5" cy="12.5" r="1.5" fill={color ?? 'currentColor'} />
      </g>
    </svg>
  );
};
