import { useContext } from 'react';

import {
  ThemeContext,
  themes,
} from '../../../../../../../modules/personalization/browser';
import { TimelinePoint } from '../../../../../components/icons/TimelinePoint';

const CommitSkeleton = ({
  isFirst = false,
  isLast = false,
}: {
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const { resolvedTheme } = useContext(ThemeContext);

  return (
    <div>
      <div className="flex flex-row items-center">
        <div className="color-gray-200 h-full w-14 flex-shrink-0">
          <TimelinePoint
            circleSize={7.5}
            hasTopStem={!isFirst}
            hasBottomStem={!isLast}
            color={resolvedTheme === themes.light ? '#e5e7eb' : '#374151'}
          />
        </div>
        <div className="h-4 w-3/4 bg-gray-200"></div>
      </div>
    </div>
  );
};

export const ChangeLogSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <CommitSkeleton
          key={index}
          isFirst={index === 0}
          isLast={index === count - 1}
        />
      ))}
    </div>
  );
};
