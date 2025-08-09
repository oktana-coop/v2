import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
></svg>;

export const ImageIcon = ({
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
          d="M7.125 7.55556C5.67525 7.55556 4.5 8.74946 4.5 10.2222C4.5 11.695 5.67525 12.8889 7.125 12.8889C8.57475 12.8889 9.75 11.695 9.75 10.2222C9.75 8.74946 8.57475 7.55556 7.125 7.55556ZM6.25 10.2222C6.25 9.7313 6.64175 9.33333 7.125 9.33333C7.60825 9.33333 8 9.7313 8 10.2222C8 10.7131 7.60825 11.1111 7.125 11.1111C6.64175 11.1111 6.25 10.7131 6.25 10.2222Z"
          fill={color ?? 'currentColor'}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.625 4C2.17525 4 1 5.19391 1 6.66667V17.3333C1 18.8061 2.17525 20 3.625 20H19.375C20.8247 20 22 18.8061 22 17.3333V6.66667C22 5.19391 20.8247 4 19.375 4H3.625ZM19.375 5.77778H3.625C3.14175 5.77778 2.75 6.17575 2.75 6.66667V17.3333C2.75 17.8243 3.14175 18.2222 3.625 18.2222H7.39953L13.4183 12.1079C14.4435 11.0665 16.1055 11.0665 17.1306 12.1079L20.25 15.2767V6.66667C20.25 6.17575 19.8582 5.77778 19.375 5.77778ZM19.375 18.2222H9.8744L14.6558 13.365C14.9975 13.0178 15.5515 13.0178 15.8932 13.365L20.1686 17.7082C20.0294 18.0118 19.7264 18.2222 19.375 18.2222Z"
          fill={color ?? 'currentColor'}
        />
      </g>
    </svg>
  );
};
