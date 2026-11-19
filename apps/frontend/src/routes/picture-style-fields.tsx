import {
  MEDIA_FITS,
  MEDIA_FOCI,
  MEDIA_RATIO_PRESETS,
  type MediaStyle,
  parseMediaRatio,
} from '@quiz-dock/contracts';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import type { QuestionFormApi } from './question-form-model';

/** A reveal's length when one is added: sharp well before most answer times end. */
export const REVEAL_DEFAULT_S = 10;

const FREE = 'free';

/**
 * How a question's picture or video is shown (SPECIFICATIONS-QUESTION-PICTURE): its
 * frame's ratio (the file's, a preset or typed), how it fills it, where it is cropped,
 * and a picture's progressive reveal. Behind the text the media fills the area: only
 * the crop point is left.
 */
export function PictureStyleFields({
  form,
  image,
  behind,
  timeLimitS,
}: {
  form: QuestionFormApi;
  /** A picture: the reveal is offered (never a video's). */
  image: boolean;
  behind: boolean;
  /** The reveal is over before the answers close. */
  timeLimitS: number;
}) {
  const { t } = useTranslation('editor');
  return (
    <form.Field name="mediaStyle">
      {(field) => {
        const style = field.state.value;
        const set = (patch: Partial<MediaStyle>) => {
          const next: MediaStyle = { ...style, ...patch };
          // An unset setting is left out: an empty style is no style.
          for (const k of Object.keys(next) as (keyof MediaStyle)[]) {
            if (next[k] === undefined) delete next[k];
          }
          field.handleChange(next);
        };
        const fill = behind ? 'cover' : (style.fit ?? 'contain');
        return (
          <div className="flex flex-col gap-3">
            {behind ? (
              <p className="text-muted-foreground text-xs">{t('timeline.picture.behindNote')}</p>
            ) : (
              <>
                <RatioField value={style.ratio} onChange={(ratio) => set({ ratio })} />
                <Choice label={t('timeline.picture.fit')}>
                  <Segmented
                    label={t('timeline.picture.fit')}
                    value={fill}
                    onChange={(fit) => set({ fit: fit === 'contain' ? undefined : fit })}
                    options={MEDIA_FITS.map((fit) => ({
                      value: fit,
                      label: t(`timeline.picture.fitValue.${fit}`),
                    }))}
                  />
                </Choice>
              </>
            )}
            {fill === 'cover' ? (
              <Choice label={t('timeline.picture.focus')}>
                <Segmented
                  label={t('timeline.picture.focus')}
                  value={style.focus ?? 'center'}
                  onChange={(focus) => set({ focus: focus === 'center' ? undefined : focus })}
                  options={MEDIA_FOCI.map((focus) => ({
                    value: focus,
                    label: t(`timeline.picture.focusValue.${focus}`),
                  }))}
                />
              </Choice>
            ) : null}
            {image ? (
              <div className="flex flex-col gap-1.5">
                <CheckboxField
                  checked={!!style.revealS}
                  onChange={(on) =>
                    set({ revealS: on ? Math.min(REVEAL_DEFAULT_S, timeLimitS) : undefined })
                  }
                  label={t('timeline.picture.reveal')}
                  hint={t('timeline.picture.revealHint')}
                />
                {style.revealS ? (
                  <label className="flex items-center gap-2 text-sm">
                    {t('timeline.picture.revealSeconds')}
                    <Input
                      type="number"
                      className="w-24"
                      min={1}
                      max={timeLimitS}
                      value={style.revealS}
                      onChange={(e) =>
                        set({
                          revealS: Math.min(timeLimitS, Math.max(1, Number(e.target.value) || 1)),
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      }}
    </form.Field>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

/** The file's ratio, a preset, or one typed `W:H` — kept only once it reads as one. */
function RatioField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (ratio: string | undefined) => void;
}) {
  const { t } = useTranslation('editor');
  const preset = !value
    ? 'file'
    : (MEDIA_RATIO_PRESETS as readonly string[]).includes(value)
      ? value
      : FREE;
  const [freeOpen, setFreeOpen] = useState(preset === FREE);
  const [typed, setTyped] = useState(preset === FREE ? (value ?? '') : '');
  const [invalid, setInvalid] = useState(false);
  const shown = freeOpen ? FREE : preset;
  return (
    <Choice label={t('timeline.picture.ratio')}>
      <Segmented
        label={t('timeline.picture.ratio')}
        value={shown}
        onChange={(next) => {
          setInvalid(false);
          if (next === FREE) {
            setFreeOpen(true);
            return;
          }
          setFreeOpen(false);
          onChange(next === 'file' ? undefined : next);
        }}
        options={[
          { value: 'file', label: t('timeline.picture.ratioFile') },
          ...MEDIA_RATIO_PRESETS.map((r) => ({ value: r, label: r })),
          { value: FREE, label: t('timeline.picture.ratioFree') },
        ]}
      />
      {freeOpen ? (
        <div className="flex flex-col gap-1">
          <Input
            aria-label={t('timeline.picture.ratioFreeLabel')}
            placeholder="21:9"
            className="w-28"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => {
              const ok = parseMediaRatio(typed.trim()) !== null;
              setInvalid(!ok);
              if (ok) onChange(typed.trim());
            }}
          />
          {invalid ? (
            <p role="alert" className="text-destructive text-xs">
              {t('timeline.picture.ratioInvalid')}
            </p>
          ) : null}
        </div>
      ) : null}
    </Choice>
  );
}
