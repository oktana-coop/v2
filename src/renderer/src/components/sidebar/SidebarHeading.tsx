import { IconProps } from '../../components/icons/types';

type SidebarHeadingProps = {
  icon?: React.ComponentType<IconProps>;
  text: string;
  onClick?: () => void;
};

export const SidebarHeading = ({ icon: Icon, text }: SidebarHeadingProps) => (
  <div className="flex gap-x-2 items-center mb-4">
    {Icon && (
      <Icon className="text-black text-opacity-75 dark:text-white dark:text-opacity-75" />
    )}
    <h3 className="font-bold text-base/4 text-black dark:text-white text-opacity-75 dark:text-opacity-75">
      {text}
    </h3>
  </div>
);
