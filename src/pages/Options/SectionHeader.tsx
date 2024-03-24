import { Heading2 } from '../../components/typography/headings/Heading2';
import { IconProps } from '../../components/icons/types';

type SectionHeaderProps = {
  icon: React.ComponentType<IconProps>;
  heading: string;
};

export const SectionHeader = ({ icon: Icon, heading }: SectionHeaderProps) => (
  <div className="flex gap-x-2 items-center mb-4">
    <Icon className="text-black text-opacity-90 dark:text-white dark:text-opacity-90" />
    <Heading2>{heading}</Heading2>
  </div>
);
