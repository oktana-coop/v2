import { IconProps } from './types';
import { DEFAULT_COLOR, DEFAULT_SIZE } from './constants';

const PenIcon = ({
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
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M19.5508 3.25165C19.2153 2.91612 18.6713 2.91612 18.3357 3.25165L17.5862 4.00116C16.6281 3.54347 15.4458 3.71141 14.6523 4.50498L5.5393 13.618L10.3995 18.4782L19.5125 9.36523C20.3061 8.57166 20.474 7.38938 20.0164 6.43128L20.7659 5.68178C21.1014 5.34624 21.1014 4.80224 20.7659 4.46671L19.5508 3.25165ZM15.8838 10.5638L10.3995 16.0481L7.96942 13.618L13.4537 8.13368L15.8838 10.5638ZM17.446 9.00159L18.2975 8.15017C18.633 7.81464 18.633 7.27064 18.2975 6.93511L17.0824 5.72004C16.7469 5.38451 16.2029 5.38451 15.8673 5.72004L15.0159 6.57146L17.446 9.00159Z"
          fill={color}
        />
        <path d="M3 21L4.82293 14.3168L9.68285 19.1774L3 21Z" fill={color} />
      </g>
    </svg>
  );
};

export default PenIcon;
