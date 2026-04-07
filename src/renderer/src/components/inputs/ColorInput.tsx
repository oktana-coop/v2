import { clsx } from 'clsx';

type ColorInputProps = {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  'aria-label'?: string;
};

export const ColorInput = ({
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: ColorInputProps) => (
  <input
    type="color"
    data-slot="control"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={ariaLabel}
    className={clsx(
      'block h-9 w-11 shrink-0 cursor-pointer border border-zinc-950/10 bg-transparent p-0.5',
      'dark:border-white/10',
      className
    )}
  />
);
