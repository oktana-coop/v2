import { IconProps } from '../../components/icons/types';

type SidebarHeadingProps = {
  icon?: React.ComponentType<IconProps>;
  text: string;
  onClick?: () => void;
};

export const SidebarHeading = ({ icon: Icon, text }: SidebarHeadingProps) => (
  <div className="flex items-center gap-x-2">
    {Icon && (
      <Icon className="text-black text-opacity-75 dark:text-white dark:text-opacity-75" />
    )}
    <h3 className="text-base/4 font-bold text-black text-opacity-75 dark:text-white dark:text-opacity-75">
      {text}
    </h3>
  </div>
);
