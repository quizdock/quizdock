import { Clock, Eye, Image as ImageIcon, Music, Video, Volume2 } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { mediaControllerDescribe } from '../api/generated/media/media';
import type { StepTimeline as Model, TimelineElement, TimelinePhase } from './step-timeline-model';

/** Heights of the rows, in px: the elements are laid over them. */
const ROW = { time: 18, channel: 26, gap: 3 } as const;
/** How much lower an element sits over the one it collides with. */
const LOWERED = 8;
const VISUAL = 'var(--timeline-visual)';
const AUDIO = 'var(--timeline-audio)';
const mix = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, var(--card))`;
const round = (s: number) => Math.round(s);

/**
 * The step's timeline (SPECIFICATIONS-QUESTION-TIMELINE): one row per channel — time,
 * picture, sound — and each element drawn once over the channels it has. Read-only:
 * the fields below still edit the step.
 */
export function StepTimeline({ model }: { model: Model }) {
  const { t } = useTranslation('editor');
  const T = model.totalS;
  const pct = (s: number) => `${(Math.min(s, T) / T) * 100}%`;
  const stretched = model.actualS !== null && model.actualS > model.minimumS;

  let ticks: number[] = [];
  const step = T > 60 ? 10 : 5;
  for (let s = 0; s <= T - 3; s += step) ticks.push(s);
  ticks = [...ticks, T];

  return (
    <section aria-label={t('timeline.legend')} className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs tabular-nums">
        <span className="text-muted-foreground mr-1 font-semibold tracking-wider uppercase">
          {t('timeline.legend')}
        </span>
        <Chip
          tone={stretched ? 'warning' : undefined}
          tip={
            model.actualS === null
              ? t('timeline.phase.manual')
              : stretched
                ? t('timeline.stretched', { minimum: model.minimumS, actual: model.actualS })
                : t('timeline.minimum', { seconds: model.minimumS })
          }
        >
          {model.actualS === null
            ? t('timeline.manualShort')
            : stretched
              ? `${model.minimumS} s → ${model.actualS} s`
              : `${model.minimumS} s`}
        </Chip>
        <Chip tip={t('timeline.total', { seconds: round(T) })}>{round(T)} s</Chip>
      </div>

      <div className="grid grid-cols-[22px_1fr] gap-x-1 select-none">
        <span />
        <div className="relative h-3.5">
          {ticks.map((s, i) => (
            <span
              key={s}
              className={cn(
                'text-muted-foreground absolute top-0 text-[10px] whitespace-nowrap',
                i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: pct(s) }}
            >
              {i === ticks.length - 1 ? `${round(s)} s` : s}
            </span>
          ))}
        </div>

        <Row color="var(--timeline-time)" icon={<Clock />} tip={t('timeline.timeRow')}>
          <div className="relative overflow-hidden" style={{ height: ROW.time }}>
            {model.phases.map((p) => (
              <Phase key={p.kind + p.from} phase={p} pct={pct} />
            ))}
          </div>
        </Row>
        <div className="col-span-2" style={{ height: ROW.gap }} />
        <Row color={VISUAL} icon={<Eye />} tip={t('timeline.visualRow')}>
          <div style={{ height: ROW.channel }} />
        </Row>
        <div className="col-span-2" style={{ height: ROW.gap }} />
        <Row color={AUDIO} icon={<Volume2 />} tip={t('timeline.audioRow')}>
          <div className="relative" style={{ height: ROW.channel }}>
            {/* The elements, laid over both channel rows from here. */}
            <div
              className="absolute inset-x-0"
              style={{ bottom: 0, height: ROW.channel * 2 + ROW.gap }}
            >
              {model.elements.map((e, i) => (
                <Element key={e.kind + i} element={e} pct={pct} z={i + 1} />
              ))}
            </div>
          </div>
        </Row>
      </div>
    </section>
  );
}

function Chip({ children, tip, tone }: { children: ReactNode; tip: string; tone?: 'warning' }) {
  return (
    <Tooltip label={tip}>
      <span
        tabIndex={0}
        className={cn(
          'rounded-full border px-2 py-px',
          tone === 'warning' && 'border-warning text-warning-text',
        )}
      >
        {children}
      </span>
    </Tooltip>
  );
}

/** A channel's row: its colour behind the icon and the lane alike. */
function Row({
  color,
  icon,
  tip,
  children,
}: {
  color: string;
  icon: ReactNode;
  tip: string;
  children: ReactNode;
}) {
  return (
    <div
      className="col-span-2 grid grid-cols-[22px_1fr] items-center gap-x-1 rounded"
      style={{ background: mix(color, 9) }}
    >
      <Tooltip label={tip} className="justify-center">
        <span
          tabIndex={0}
          role="img"
          aria-label={tip}
          className="grid size-[22px] place-items-center [&_svg]:size-3.5"
          style={{ color }}
        >
          {icon}
        </span>
      </Tooltip>
      {children}
    </div>
  );
}

function Phase({ phase, pct }: { phase: TimelinePhase; pct: (s: number) => string }) {
  const { t } = useTranslation('editor');
  const len = round(phase.to - phase.from);
  const color = 'var(--timeline-time)';
  const background =
    phase.kind === 'stretch'
      ? `repeating-linear-gradient(135deg, ${mix(color, 40)} 0 5px, transparent 5px 10px)`
      : mix(color, phase.kind === 'answers' || phase.kind === 'display' ? 40 : 20);
  const text =
    phase.kind === 'answers' || phase.kind === 'display'
      ? `${len} s`
      : phase.kind === 'stretch'
        ? `+${len}`
        : phase.kind === 'manual'
          ? t('timeline.manualShort')
          : '';
  return (
    <Tooltip
      label={t(`timeline.phase.${phase.kind}`, { seconds: len })}
      className="absolute inset-y-0"
      style={{ left: pct(phase.from), width: pct(phase.to - phase.from) }}
    >
      <span
        tabIndex={0}
        className={cn(
          'flex size-full items-center overflow-hidden px-1 text-[11px] whitespace-nowrap',
          phase.kind === 'stretch' && 'text-warning-text',
          phase.kind === 'tail' && 'border-l border-dashed',
          phase.kind === 'manual' && 'border-r-2 border-dashed',
        )}
        style={{ background, borderColor: color }}
      >
        {text}
      </span>
    </Tooltip>
  );
}

function Element({
  element: e,
  pct,
  z,
}: {
  element: TimelineElement;
  pct: (s: number) => string;
  z: number;
}) {
  const { t } = useTranslation('editor');
  const visual = e.visualTo !== null;
  const audio = e.audioTo !== null;
  const end = Math.max(e.visualTo ?? 0, e.audioTo ?? 0);
  const channelTop = ROW.channel + ROW.gap;
  const top = (visual ? 0 : channelTop) + 2 + (e.lowered ? LOWERED : 0);
  const bottom = (audio ? channelTop + ROW.channel : ROW.channel) - 2;
  const height = bottom - top;
  // The split between the two rows, from the element's own top.
  const split = ROW.channel + ROW.gap / 2 - top;
  const soft = e.kind === 'image' || e.kind === 'background';
  const fill = (color: string) => (soft ? mix(color, 28) : color);
  const background =
    visual && audio
      ? `linear-gradient(${fill(VISUAL)} 0 ${split}px, ${fill(AUDIO)} ${split}px)`
      : fill(visual ? VISUAL : AUDIO);
  const border = visual ? VISUAL : AUDIO;
  const seconds = e.lengthS === null ? null : round(e.lengthS);
  const tip =
    e.kind === 'image'
      ? t('timeline.element.image')
      : e.kind === 'background'
        ? t('timeline.element.background')
        : e.kind === 'video'
          ? e.loop
            ? t('timeline.element.videoLoop')
            : seconds === null
              ? t('timeline.element.unknown')
              : t(audio ? 'timeline.element.video' : 'timeline.element.videoMuted', { seconds })
          : seconds === null
            ? t('timeline.element.unknown')
            : t('timeline.element.audio', { seconds });
  const Icon = e.kind === 'video' ? Video : e.kind === 'audio' ? Music : ImageIcon;
  const label =
    e.kind === 'audio' ? (seconds === null ? '' : `${seconds} s`) : t(`timeline.label.${e.kind}`);
  const style: CSSProperties = {
    left: pct(e.from),
    width: pct(end - e.from),
    top,
    height,
    zIndex: z,
  };
  return (
    <Tooltip label={tip} className="absolute" style={style}>
      <span
        tabIndex={0}
        role="img"
        aria-label={tip}
        className={cn(
          'relative flex size-full flex-col overflow-hidden rounded text-[11px]',
          soft ? 'text-foreground' : 'text-background',
          e.lowered && 'shadow-[0_-1px_3px_rgb(0_0_0/0.3)]',
        )}
        style={{
          background,
          boxShadow: soft ? `inset 0 0 0 1px ${border}` : undefined,
        }}
      >
        <span
          className="flex min-w-0 items-center gap-1 px-1.5"
          style={{ height: visual ? Math.min(split, height) : height }}
        >
          <Icon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          {!visual && e.peaks ? <Peaks peaks={e.peaks} /> : null}
        </span>
        {visual && audio ? (
          <span className="flex min-h-0 flex-1 items-center px-1.5">
            {e.peaks ? <Peaks peaks={e.peaks} /> : null}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

/** The sound's waveform, from the peaks the media library keeps. */
function Peaks({ peaks }: { peaks: number[] }) {
  const n = 80;
  const bars = Array.from({ length: n }, (_, i) => {
    const slice = peaks.slice(
      Math.floor((i * peaks.length) / n),
      Math.max(Math.floor(((i + 1) * peaks.length) / n), Math.floor((i * peaks.length) / n) + 1),
    );
    return slice.length ? Math.max(...slice) : 0;
  });
  return (
    <svg
      viewBox={`0 0 ${n * 3} 20`}
      preserveAspectRatio="none"
      className="h-3.5 min-w-0 flex-1 opacity-60"
      aria-hidden
    >
      {bars.map((v, i) => {
        const h = Math.max(0.12, v) * 20;
        return <rect key={i} x={i * 3} y={10 - h / 2} width={2} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}

/** A media's length, as the library describes it; null while unknown. */
export function useAssetDurationMs(id: string | null): number | null {
  const [known, setKnown] = useState<{ id: string; ms: number | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void mediaControllerDescribe(id)
      .then(({ data }) => !cancelled && setKnown({ id, ms: data.durationMs ?? null }))
      .catch(() => undefined); // no length rather than a wrong one
    return () => {
      cancelled = true;
    };
  }, [id]);
  return id && known?.id === id ? known.ms : null;
}
