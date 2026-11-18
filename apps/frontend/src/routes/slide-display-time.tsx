import { useTranslation } from 'react-i18next';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

/** Auto-mode display time: null = engine default, 0 = manual override, N = custom seconds. */
export function DisplayTimeField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation('editor');
  const mode = value === null ? 'default' : value === 0 ? 'manual' : 'custom';
  return (
    <Disclosure
      title={t('slideForm.displayLegend')}
      value={mode === 'custom' ? `${value} s` : t(`slideForm.display.${mode}`)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label={t('slideForm.displayLegend')}
          className="w-56"
          value={mode}
          onChange={(e) =>
            onChange(e.target.value === 'default' ? null : e.target.value === 'manual' ? 0 : 10)
          }
        >
          <option value="default">{t('slideForm.display.default')}</option>
          <option value="manual">{t('slideForm.display.manual')}</option>
          <option value="custom">{t('slideForm.display.custom')}</option>
        </Select>
        {mode === 'custom' ? (
          <Input
            type="number"
            aria-label={t('slideForm.displayDelayLabel')}
            min={1}
            max={600}
            className="w-24"
            value={value ?? ''}
            onChange={(e) => onChange(Math.min(600, Math.max(1, Number(e.target.value) || 1)))}
          />
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">{t('slideForm.displayHint')}</p>
    </Disclosure>
  );
}
