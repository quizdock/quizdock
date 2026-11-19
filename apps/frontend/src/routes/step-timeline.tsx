import {
  Clock,
  Eraser,
  Eye,
  GanttChart,
  Image as ImageIcon,
  LayoutTemplate,
  List,
  Music,
  Plus,
  Sparkles,
  Video,
  Volume2,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { StepView } from '@quiz-dock/contracts';
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

/** What the drawer shows: the step's own settings, or one of its elements (one of each kind). */
export type TimelineSelection = 'time' | TimelineElement['kind'];

/** The timeline as an editor: its elements and its time row open the drawer. */
export interface TimelineEditing {
  selected: TimelineSelection | null;
  onSelect: (selection: TimelineSelection) => void;
  onAdd: () => void;
  /** Takes every element away; absent while there is none. */
  onClear: (() => void) | null;
  /** The ready-made layouts; `refused` says why they do not apply yet. */
  layout?: { open: () => void; refused: string | null };
  /** Timeline or list, the account's choice: the same elements, the same panel. */
  view?: { value: StepView; onChange: (view: StepView) => void };
}

/**
 * The step's timeline (SPECIFICATIONS-QUESTION-TIMELINE): one row per channel — time,
 * picture, sound — and each element drawn once over the channels it has. With `edit`,
 * it is where the step's media are added, picked and taken away.
 */
export function StepTimeline({ model, edit }: { model: Model; edit?: TimelineEditing }) {
  const { t } = useTranslation('editor');
  const T = model.totalS;
  const pct = (s: number) => `${(Math.min(s, T) / T) * 100}%`;
  const stretched = model.actualS !== null && model.actualS > model.minimumS;
  const [confirmClear, setConfirmClear] = useState(false);

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
          onClick={edit ? () => edit.onSelect('time') : undefined}
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
        {edit ? (
          <span className="ml-auto flex items-center gap-0.5">
            {edit.view ? (
              <span
                role="group"
                aria-label={t('timeline.view.label')}
                className="mr-1 inline-flex gap-0.5 rounded-md border p-0.5"
              >
                {(['timeline', 'list'] as const).map((v) => {
                  const ViewIcon = v === 'timeline' ? GanttChart : List;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={edit.view!.value === v}
                      onClick={() => edit.view!.onChange(v)}
                      className={cn(
                        'text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-1 rounded px-1.5 py-0.5 focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-3.5',
                        edit.view!.value === v && 'bg-accent text-foreground',
                      )}
                    >
                      <ViewIcon aria-hidden />
                      {t(`timeline.view.${v}`)}
                    </button>
                  );
                })}
              </span>
            ) : null}
            {edit.layout ? (
              <Tool
                icon={<LayoutTemplate />}
                label={edit.layout.refused ?? t('timeline.layout')}
                disabled={edit.layout.refused !== null}
                onClick={edit.layout.open}
              />
            ) : null}
            {edit.onClear ? (
              <Tool
                icon={<Eraser />}
                label={t('timeline.clear')}
                onClick={() => setConfirmClear(true)}
              />
            ) : null}
            <Tool icon={<Plus />} label={t('timeline.add')} onClick={edit.onAdd} />
          </span>
        ) : null}
      </div>

      {edit?.view?.value === 'list' ? (
        <StepList model={model} edit={edit} />
      ) : (
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
            {/* The mouse's way to the step's settings; the keyboard's is the duration chip. */}
            <div
              className={cn(
                'relative overflow-hidden',
                edit && 'cursor-pointer',
                edit?.selected === 'time' && 'ring-ring rounded-sm ring-2',
              )}
              style={{ height: ROW.time }}
              onClick={edit ? () => edit.onSelect('time') : undefined}
            >
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
                  <Element
                    key={e.kind + i}
                    element={e}
                    pct={pct}
                    z={i + 1}
                    selected={edit?.selected === e.kind}
                    onSelect={edit ? () => edit.onSelect(e.kind) : undefined}
                  />
                ))}
              </div>
            </div>
          </Row>
        </div>
      )}
      {edit?.onClear ? (
        <ConfirmDialog
          open={confirmClear}
          title={t('timeline.clearConfirm.title')}
          description={t('timeline.clearConfirm.description')}
          confirmLabel={t('timeline.clearConfirm.confirm')}
          destructive
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            edit.onClear?.();
          }}
        />
      ) : null}
    </section>
  );
}

function Chip({
  children,
  tip,
  tone,
  onClick,
}: {
  children: ReactNode;
  tip: string;
  tone?: 'warning';
  onClick?: () => void;
}) {
  const className = cn(
    'rounded-full border px-2 py-px',
    tone === 'warning' && 'border-warning text-warning-text',
    onClick && 'hover:bg-accent',
  );
  return (
    <Tooltip label={tip}>
      {onClick ? (
        <button type="button" aria-label={tip} className={className} onClick={onClick}>
          {children}
        </button>
      ) : (
        <span tabIndex={0} className={className}>
          {children}
        </span>
      )}
    </Tooltip>
  );
}

function Tool({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** Still in sight and focusable, its tooltip saying why. */
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={cn(
          'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-6 place-items-center rounded focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-4',
          disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        )}
        onClick={disabled ? undefined : onClick}
      >
        {icon}
      </button>
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
  selected,
  onSelect,
}: {
  element: TimelineElement;
  pct: (s: number) => string;
  z: number;
  selected: boolean;
  /** Absent, the element is only drawn. */
  onSelect?: () => void;
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
  const soft = e.kind === 'image' || e.kind === 'reveal';
  const fill = (color: string) => (soft ? mix(color, 28) : color);
  const background =
    e.kind === 'reveal'
      ? // Blurred to sharp: the picture's colour comes in along it.
        `linear-gradient(90deg, ${mix(VISUAL, 8)}, ${mix(VISUAL, 55)})`
      : visual && audio
        ? `linear-gradient(${fill(VISUAL)} 0 ${split}px, ${fill(AUDIO)} ${split}px)`
        : fill(visual ? VISUAL : AUDIO);
  const border = visual ? VISUAL : AUDIO;
  const { tip, label, Icon } = elementText(e, t);
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
        role={onSelect ? 'button' : 'img'}
        aria-label={tip}
        aria-pressed={onSelect ? selected : undefined}
        onClick={onSelect}
        onKeyDown={
          onSelect
            ? (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                onSelect();
              }
            : undefined
        }
        className={cn(
          'relative flex size-full flex-col overflow-hidden rounded text-[11px]',
          soft ? 'text-foreground' : 'text-background',
          e.lowered && 'shadow-[0_-1px_3px_rgb(0_0_0/0.3)]',
          onSelect &&
            'focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
          selected && 'ring-ring ring-2 ring-offset-1',
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

/** What an element is called, in its tooltip and on its shape, and its icon: one wording for both views. */
function elementText(e: TimelineElement, t: TFunction<'editor'>) {
  const audio = e.audioTo !== null;
  const seconds = e.lengthS === null ? null : round(e.lengthS);
  const tip =
    e.kind === 'image'
      ? t('timeline.element.image')
      : e.kind === 'reveal'
        ? t('timeline.element.reveal', { seconds })
        : e.kind === 'video'
          ? e.loop
            ? t('timeline.element.videoLoop')
            : seconds === null
              ? t('timeline.element.unknown')
              : t(audio ? 'timeline.element.video' : 'timeline.element.videoMuted', { seconds })
          : seconds === null
            ? t('timeline.element.unknown')
            : t('timeline.element.audio', { seconds });
  const Icon =
    e.kind === 'video'
      ? Video
      : e.kind === 'audio'
        ? Music
        : e.kind === 'reveal'
          ? Sparkles
          : ImageIcon;
  const label =
    e.kind === 'audio' ? (seconds === null ? '' : `${seconds} s`) : t(`timeline.label.${e.kind}`);
  return { tip, label, Icon, seconds };
}

/**
 * The accessible view of the same step (SPECIFICATIONS-QUESTION-TIMELINE §4): its flow,
 * then one row per element — channels, start, length, what it does, in words. Each row
 * opens the same panel as on the timeline: its button for the keyboard, the row for the mouse.
 */
function StepList({ model, edit }: { model: Model; edit: TimelineEditing }) {
  const { t } = useTranslation('editor');
  const stretch = model.phases.find((p) => p.kind === 'stretch');
  const end = (e: TimelineElement) => Math.max(e.visualTo ?? 0, e.audioTo ?? 0);
  const rows: {
    key: TimelineSelection;
    Icon: typeof Clock;
    color: string;
    name: string;
    channels: ('time' | 'visual' | 'audio')[];
    from: number;
    length: string;
    note: string;
  }[] = [
    {
      key: 'time',
      Icon: Clock,
      color: 'var(--timeline-time)',
      name: t('timeline.list.flow'),
      channels: ['time'],
      from: 0,
      length: `${round(model.totalS)} s`,
      note: model.phases
        .map((p) => t(`timeline.phase.${p.kind}`, { seconds: round(p.to - p.from) }))
        .join(' · '),
    },
    ...model.elements.map((e) => {
      const { tip, Icon, seconds } = elementText(e, t);
      const stretches =
        stretch && e.kind !== 'image' && e.kind !== 'reveal' && end(e) >= stretch.to - 0.01;
      return {
        // The reveal is the picture's: its row opens the picture's panel.
        key: e.kind,
        Icon,
        color: e.visualTo !== null ? VISUAL : AUDIO,
        name: t(`timeline.choice.${e.kind}`),
        channels: [
          ...(e.visualTo !== null ? (['visual'] as const) : []),
          ...(e.audioTo !== null ? (['audio'] as const) : []),
        ],
        from: e.from,
        length:
          seconds === null
            ? t('timeline.list.untilEnd', { seconds: round(end(e)) })
            : `${seconds} s`,
        note: stretches
          ? `${tip} · ${t('timeline.list.stretches', { seconds: round(stretch.to - stretch.from) })}`
          : tip,
      };
    }),
  ];
  const CHANNEL = {
    time: 'var(--timeline-time)',
    visual: VISUAL,
    audio: AUDIO,
  } as const;
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <caption className="text-muted-foreground pb-1 text-left text-xs">
        {t('timeline.list.caption', { n: model.elements.length, total: round(model.totalS) })}
      </caption>
      <thead>
        <tr className="text-muted-foreground border-b text-left text-xs">
          <th className="px-2 py-1 font-medium">{t('timeline.list.element')}</th>
          <th className="px-2 py-1 font-medium">{t('timeline.list.channels')}</th>
          <th className="px-2 py-1 font-medium">{t('timeline.list.start')}</th>
          <th className="px-2 py-1 font-medium">{t('timeline.list.length')}</th>
          <th className="px-2 py-1 font-medium">{t('timeline.list.note')}</th>
          <th className="px-2 py-1">
            <span className="sr-only">{t('timeline.list.open')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const opens = r.key === 'reveal' ? 'image' : r.key;
          const selected = edit.selected === opens;
          return (
            <tr
              key={r.key}
              onClick={() => edit.onSelect(r.key)}
              className={cn(
                'hover:bg-accent cursor-pointer border-b',
                selected && 'bg-primary/10 hover:bg-primary/10',
              )}
            >
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <r.Icon className="size-3.5 shrink-0" style={{ color: r.color }} aria-hidden />
                  {r.name}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className="flex gap-2">
                  {r.channels.map((c) => (
                    <span key={c} className="flex items-center gap-1 text-xs">
                      <span
                        className="size-2 rounded-[2px]"
                        style={{ background: CHANNEL[c] }}
                        aria-hidden
                      />
                      {t(`timeline.list.channel.${c}`)}
                    </span>
                  ))}
                </span>
              </td>
              <td className="px-2 py-1.5">{round(r.from)} s</td>
              <td className="px-2 py-1.5">{r.length}</td>
              <td className="px-2 py-1.5">{r.note}</td>
              <td className="px-2 py-1.5 text-right">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={t(
                    r.key === 'time' ? 'timeline.list.settingsNamed' : 'timeline.list.openNamed',
                    { name: r.name },
                  )}
                  className="hover:bg-accent focus-visible:ring-ring rounded-md border px-2 py-0.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    edit.onSelect(r.key);
                  }}
                >
                  {t(r.key === 'time' ? 'timeline.list.settings' : 'timeline.list.open')}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
