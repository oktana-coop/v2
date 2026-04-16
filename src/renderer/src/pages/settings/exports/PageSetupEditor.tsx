import { useState } from 'react';

import {
  type Margins,
  MM_PER_CM,
  MM_PER_INCH,
  type NumberFormat,
  numberFormats,
  type Orientation,
  orientations,
  type PageNumberAlignment,
  pageNumberAlignments,
  type PageNumberPosition,
  pageNumberPositions,
  type PageNumbers,
  type PageSetup,
  type PaperSize,
  paperSizePresets,
} from '../../../../../modules/personalization';
import { Checkbox, CheckboxField } from '../../../components/inputs/Checkbox';
import { Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { SegmentedControl } from '../../../components/inputs/SegmentedControl';
import { Switch } from '../../../components/inputs/Switch';

type PageSetupEditorProps = {
  pageSetup: PageSetup;
  onChange: (pageSetup: PageSetup) => void;
};

type DisplayUnit = 'cm' | 'in';

const mmToDisplay = (mm: number, unit: DisplayUnit): number =>
  unit === 'cm'
    ? Math.round((mm / MM_PER_CM) * 100) / 100
    : Math.round((mm / MM_PER_INCH) * 100) / 100;

const displayToMm = (value: number, unit: DisplayUnit): number =>
  unit === 'cm' ? value * MM_PER_CM : value * MM_PER_INCH;

const presetList = Object.values(paperSizePresets);

const findPresetKey = (paperSize: PaperSize): string | undefined =>
  Object.entries(paperSizePresets).find(
    ([, preset]) =>
      preset.width === paperSize.width && preset.height === paperSize.height
  )?.[0];

const orientationOptions = orientations.map((value) => ({
  value,
  label: (
    <span className="px-1 text-xs">
      {value === 'portrait' ? 'Portrait' : 'Landscape'}
    </span>
  ),
}));

const unitOptions: { value: DisplayUnit; label: React.ReactNode }[] = [
  { value: 'cm', label: <span className="px-1 text-xs">cm</span> },
  { value: 'in', label: <span className="px-1 text-xs">in</span> },
];

const positionLabels: Record<PageNumberPosition, string> = {
  header: 'Header',
  footer: 'Footer',
};

const alignmentLabels: Record<PageNumberAlignment, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
  inside: 'Inside',
  outside: 'Outside',
};

const numberFormatLabels: Record<NumberFormat, string> = {
  decimal: '1, 2, 3',
  'lower-roman': 'i, ii, iii',
  'upper-roman': 'I, II, III',
  'lower-alpha': 'a, b, c',
  'upper-alpha': 'A, B, C',
};

const update = (
  pageSetup: PageSetup,
  patch: Partial<PageSetup>
): PageSetup => ({ ...pageSetup, ...patch });

const MarginInput = ({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: DisplayUnit;
  onChange: (mm: number) => void;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
    <Input
      aria-label={label}
      type="number"
      value={String(mmToDisplay(value, unit))}
      onChange={(e) => {
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) onChange(displayToMm(parsed, unit));
      }}
      min="0"
      step="0.1"
    />
  </div>
);

export const PageSetupEditor = ({
  pageSetup,
  onChange,
}: PageSetupEditorProps) => {
  const [unit, setUnit] = useState<DisplayUnit>('cm');
  const [sameMargins, setSameMargins] = useState(
    pageSetup.margins.top === pageSetup.margins.bottom &&
      pageSetup.margins.top === pageSetup.margins.left &&
      pageSetup.margins.top === pageSetup.margins.right
  );

  const handleMarginChange = (side: keyof Margins, mm: number) => {
    if (sameMargins) {
      onChange(
        update(pageSetup, {
          margins: { top: mm, bottom: mm, left: mm, right: mm },
        })
      );
    } else {
      onChange(
        update(pageSetup, {
          margins: { ...pageSetup.margins, [side]: mm },
        })
      );
    }
  };

  const handleSameMarginsToggle = (checked: boolean) => {
    setSameMargins(checked);
    if (checked) {
      const value = pageSetup.margins.top;
      onChange(
        update(pageSetup, {
          margins: { top: value, bottom: value, left: value, right: value },
        })
      );
    }
  };

  const handlePaperSizeChange = (key: string) => {
    const preset = paperSizePresets[key];
    if (preset) {
      onChange(update(pageSetup, { paperSize: { ...preset } }));
    }
  };

  const handleOrientationChange = (orientation: Orientation) =>
    onChange(update(pageSetup, { orientation }));

  const updatePageNumbers = (patch: Partial<PageNumbers>) =>
    onChange(
      update(pageSetup, {
        pageNumbers: { ...pageSetup.pageNumbers, ...patch },
      })
    );

  const handlePageNumbersEnabledChange = (enabled: boolean) =>
    updatePageNumbers({ enabled });

  const handlePositionChange = (position: PageNumberPosition) =>
    updatePageNumbers({ position });

  const handleAlignmentChange = (alignment: PageNumberAlignment) =>
    updatePageNumbers({ alignment });

  const handleNumberFormatChange = (numberFormat: NumberFormat) =>
    updatePageNumbers({
      format: { ...pageSetup.pageNumbers.format, numberFormat },
    });

  const handleShowOnFirstPageChange = (showOnFirstPage: boolean) =>
    updatePageNumbers({ showOnFirstPage });

  const selectedPresetKey = findPresetKey(pageSetup.paperSize);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Listbox
          aria-label="Paper Size"
          value={selectedPresetKey ?? 'a4'}
          onChange={handlePaperSizeChange}
          modal={false}
        >
          {presetList.map((preset) => {
            const key = Object.entries(paperSizePresets).find(
              ([, p]) => p === preset
            )?.[0];
            return (
              <ListboxOption key={key} value={key}>
                <ListboxLabel>
                  {preset.name} ({mmToDisplay(preset.width, unit)} x{' '}
                  {mmToDisplay(preset.height, unit)} {unit})
                </ListboxLabel>
              </ListboxOption>
            );
          })}
        </Listbox>
        <div className="flex">
          <SegmentedControl<Orientation>
            options={orientationOptions}
            value={pageSetup.orientation}
            onChange={handleOrientationChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Margins
          </span>
          <SegmentedControl<DisplayUnit>
            options={unitOptions}
            value={unit}
            onChange={setUnit}
          />
        </div>
        <CheckboxField>
          <Checkbox
            checked={sameMargins}
            onChange={handleSameMarginsToggle}
            color="purple"
          />
          <Label>Same on all sides</Label>
        </CheckboxField>
        {sameMargins ? (
          <MarginInput
            label="All"
            value={pageSetup.margins.top}
            unit={unit}
            onChange={(mm) => handleMarginChange('top', mm)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <MarginInput
              label="Top"
              value={pageSetup.margins.top}
              unit={unit}
              onChange={(mm) => handleMarginChange('top', mm)}
            />
            <MarginInput
              label="Bottom"
              value={pageSetup.margins.bottom}
              unit={unit}
              onChange={(mm) => handleMarginChange('bottom', mm)}
            />
            <MarginInput
              label="Left"
              value={pageSetup.margins.left}
              unit={unit}
              onChange={(mm) => handleMarginChange('left', mm)}
            />
            <MarginInput
              label="Right"
              value={pageSetup.margins.right}
              unit={unit}
              onChange={(mm) => handleMarginChange('right', mm)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Page Numbers
          </span>
          <Switch
            checked={pageSetup.pageNumbers.enabled}
            onChange={handlePageNumbersEnabledChange}
            color="purple"
          />
        </div>

        {pageSetup.pageNumbers.enabled && (
          <div className="flex flex-col gap-2">
            <Listbox
              aria-label="Position"
              value={pageSetup.pageNumbers.position}
              onChange={handlePositionChange}
              modal={false}
            >
              {pageNumberPositions.map((pos) => (
                <ListboxOption key={pos} value={pos}>
                  <ListboxLabel>{positionLabels[pos]}</ListboxLabel>
                </ListboxOption>
              ))}
            </Listbox>

            <Listbox
              aria-label="Alignment"
              value={pageSetup.pageNumbers.alignment}
              onChange={handleAlignmentChange}
              modal={false}
            >
              {pageNumberAlignments.map((align) => (
                <ListboxOption key={align} value={align}>
                  <ListboxLabel>{alignmentLabels[align]}</ListboxLabel>
                </ListboxOption>
              ))}
            </Listbox>

            <Listbox
              aria-label="Number Format"
              value={pageSetup.pageNumbers.format.numberFormat}
              onChange={handleNumberFormatChange}
              modal={false}
            >
              {numberFormats.map((fmt) => (
                <ListboxOption key={fmt} value={fmt}>
                  <ListboxLabel>{numberFormatLabels[fmt]}</ListboxLabel>
                </ListboxOption>
              ))}
            </Listbox>

            <CheckboxField>
              <Checkbox
                checked={pageSetup.pageNumbers.showOnFirstPage}
                onChange={handleShowOnFirstPageChange}
                color="purple"
              />
              <Label>Show on first page</Label>
            </CheckboxField>
          </div>
        )}
      </div>
    </div>
  );
};
