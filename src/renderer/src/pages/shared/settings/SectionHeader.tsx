import { IconProps } from '../../../components/icons/types';
import { Heading2 } from '../../../components/typography/headings/Heading2';

type SectionHeaderProps = {
  icon?: React.ComponentType<IconProps>;
  heading: string;
};

export const SectionHeader = ({ icon: Icon, heading }: SectionHeaderProps) => (
  <div className="mb-4 flex items-center gap-x-2">
    {Icon && (
      <Icon className="text-black text-opacity-90 dark:text-white dark:text-opacity-90" />
    )}
    <Heading2 className="!mb-0">{heading}</Heading2>
  </div>
);
