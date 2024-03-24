import { SunIcon } from '../../components/icons/Sun';
import { Heading2 } from '../../components/typography/headings/Heading2';

export const SectionHeader = () => (
  <div className="flex gap-x-2 items-center mb-4">
    <SunIcon className="text-black text-opacity-90 dark:text-white dark:text-opacity-90" />
    <Heading2>Theme</Heading2>
  </div>
);
