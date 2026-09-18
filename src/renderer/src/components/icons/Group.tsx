import { useId } from 'react';

import { DEFAULT_SIZE } from './constants';
import { IconProps } from './types';

// Where the back person stands relative to the front one, in icon units.
const BACK_PERSON_OFFSET_X = 7;
const BACK_PERSON_OFFSET_Y = 0;
// Clearance between the front person's outline and the back person.
const GAP = 2.5;

export const GroupIcon = ({
  color,
  size = DEFAULT_SIZE,
  className,
}: IconProps) => {
  const scale = size / DEFAULT_SIZE;
  const maskId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform={`scale(${scale})`}>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle cx="8" cy="7" r={4 + GAP} fill="black" />
          <rect x="0" y="11" width={14 + GAP} height="13" fill="black" />
        </mask>

        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 11C10.2091 11 12 9.20914 12 7C12 4.79086 10.2091 3 8 3C5.79086 3 4 4.79086 4 7C4 9.20914 5.79086 11 8 11ZM8 9C9.10457 9 10 8.10457 10 7C10 5.89543 9.10457 5 8 5C6.89543 5 6 5.89543 6 7C6 8.10457 6.89543 9 8 9Z"
          fill={color ?? 'currentColor'}
        />
        <path
          d="M11 14C11.5523 14 12 14.4477 12 15V21H14V15C14 13.3431 12.6569 12 11 12H5C3.34315 12 2 13.3431 2 15V21H4V15C4 14.4477 4.44772 14 5 14H11Z"
          fill={color ?? 'currentColor'}
        />

        <g mask={`url(#${maskId})`}>
          <g
            transform={`translate(${BACK_PERSON_OFFSET_X}, ${BACK_PERSON_OFFSET_Y})`}
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 11C10.2091 11 12 9.20914 12 7C12 4.79086 10.2091 3 8 3C5.79086 3 4 4.79086 4 7C4 9.20914 5.79086 11 8 11ZM8 9C9.10457 9 10 8.10457 10 7C10 5.89543 9.10457 5 8 5C6.89543 5 6 5.89543 6 7C6 8.10457 6.89543 9 8 9Z"
              fill={color ?? 'currentColor'}
            />
            <path
              d="M11 14C11.5523 14 12 14.4477 12 15V21H14V15C14 13.3431 12.6569 12 11 12H5C3.34315 12 2 13.3431 2 15V21H4V15C4 14.4477 4.44772 14 5 14H11Z"
              fill={color ?? 'currentColor'}
            />
          </g>
        </g>
      </g>
    </svg>
  );
};
