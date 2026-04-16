import {
  Radio as HeadlessRadio,
  RadioGroup as HeadlessRadioGroup,
} from '@headlessui/react';
import { clsx } from 'clsx';

type SegmentedControlOption<ValueType extends string> = {
  value: ValueType;
  label: React.ReactNode;
};

type SegmentedControlProps<ValueType extends string> = {
  options: SegmentedControlOption<ValueType>[];
  value: ValueType;
  onChange: (value: ValueType) => void;
};

export const SegmentedControl = <ValueType extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<ValueType>) => (
  <HeadlessRadioGroup
    value={value}
    onChange={onChange}
    className="inline-flex border border-zinc-950/10 dark:border-white/10"
  >
    {options.map((option, index) => (
      <HeadlessRadio
        key={option.value}
        value={option.value}
        className={clsx(
          'flex cursor-pointer items-center justify-center p-1.5 text-sm focus:outline-none',
          'data-[checked]:bg-purple-50 data-[checked]:text-purple-700',
          'dark:text-white dark:data-[checked]:bg-purple-300 dark:data-[checked]:text-black',
          'hover:bg-zinc-950/5 dark:hover:bg-white/5 dark:hover:data-[checked]:bg-purple-300',
          'data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500',
          index > 0 && 'border-l border-zinc-950/10 dark:border-white/10'
        )}
      >
        {option.label}
      </HeadlessRadio>
    ))}
  </HeadlessRadioGroup>
);
