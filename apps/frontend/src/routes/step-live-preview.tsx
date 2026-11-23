import type { ThemeValues } from '@quiz-dock/contracts';
import { Monitor, Pin, PinOff, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { type MediaResolver, useMediaUrl } from '@/lib/media-url';
import { useQuizTheme } from '@/lib/quiz-theme';
import { useSessionState } from '@/lib/use-session-state';
import { cn } from '@/lib/utils';
import type { GameView } from '../game/use-game-session';
import { RoomScreen } from './quiz-steps-preview';

/** What a step's preview is drawn from: whether the answer shows, and how the room resolves. */
export interface PreviewContext {
  reveal: boolean;
  url: MediaResolver;
  theme: ThemeValues | null;
}

/**
 * A step as the room will see it, while it is being written (SPECIFICATIONS-STEP-EDITOR):
 * the real projection or phone, folded until asked for, pinnable at the top while the
 * form scrolls — the same for a question and a slide. `viewOf` builds the step's view;
 * `canReveal` offers to show the right answer (a question).
 */
export function StepLivePreview({
  viewOf,
  canReveal,
  deps,
}: {
  viewOf: (context: PreviewContext) => GameView;
  canReveal: boolean;
  /** What the view is built from: it is built again only when they change. */
  deps: unknown[];
}) {
  const { t } = useTranslation('editor');
  const url = useMediaUrl();
  const [device, setDevice] = useState<'projection' | 'phone'>('projection');
  const [answer, setAnswer] = useState(false);
  // Pinned, it stays at the top while the form scrolls, from one step to the next.
  const [pinned, setPinned] = useSessionState(
    'editor:preview-pinned',
    false,
    (v): v is boolean => typeof v === 'boolean',
  );
  // In the quiz's theme, as the room will see it.
  const theme = useQuizTheme();
  const reveal = canReveal && answer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => viewOf({ reveal, url, theme }), [...deps, reveal, url, theme]);
  return (
    <Disclosure
      title={t('preview.title')}
      value={t(`preview.${device}`)}
      rememberAs="question-preview"
      className={cn(pinned && 'bg-background sticky top-0 z-20 shadow-md')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented
            size="sm"
            label={t('preview.device')}
            value={device}
            onChange={setDevice}
            options={[
              {
                value: 'projection',
                label: t('preview.projection'),
                icon: Monitor,
              },
              { value: 'phone', label: t('preview.phone'), icon: Smartphone },
            ]}
          />
          {canReveal ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={answer}
                onCheckedChange={setAnswer}
                aria-label={t('preview.showAnswer')}
              />
              {t('preview.showAnswer')}
            </label>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-pressed={pinned}
            onClick={() => setPinned(!pinned)}
          >
            {pinned ? <PinOff /> : <Pin />}
            {pinned ? t('preview.unpin') : t('preview.pin')}
          </Button>
        </div>
        {/* Pinned, it leaves the form most of the screen. */}
        <div className={cn(pinned && 'mx-auto w-full max-w-[calc(40dvh*16/9)]')}>
          <RoomScreen view={view} device={device} />
        </div>
      </div>
    </Disclosure>
  );
}
