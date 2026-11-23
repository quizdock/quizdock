import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/markdown';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AnswerExplanation,
  AnswerRules,
  OptionTiles,
  Podium,
  QuestionClockBar,
  RevealAnswer,
  SlideView,
  TYPE_BASE,
} from './live-components';
import { LiveTheme, themeBackdrop } from './theme';
import { RoomVariables } from './slide-variables';
import { Surface } from './surface';
import { ImageChoiceGrid } from './image-choice';
import { useQuestionClock } from './use-countdown';
import type { GameView } from './use-game-session';

/**
 * What a participant sees right now, read-only, from the host's own view of the
 * game: a phone-sized column with the same components as the player page,
 * minus the personal parts (no answer, no personal score).
 */
export function ParticipantPreview({
  view,
  pin,
  note = true,
}: {
  view: GameView;
  pin?: string;
  /** The console's line saying it is live and read-only; a quiz preview has its own. */
  note?: boolean;
}) {
  const { t } = useTranslation('live');
  const clock = useQuestionClock(view);
  // Without a background of its own, the step is drawn on the quiz theme's (docs/themes.md).
  const themed = themeBackdrop(view.theme);
  const q = view.question;
  let body: React.ReactNode;
  if (view.state === 'SLIDE_SHOW' && view.slide) {
    body = (
      <div className="flex min-h-[32em] w-full">
        <SlideView slide={view.slide} />
      </div>
    );
  } else if ((view.state === 'ANSWERING' || view.state === 'QUESTION_SHOW') && q) {
    body = (
      <div className="flex min-h-[32em] w-full flex-col gap-[0.75em] p-[1em] text-center">
        {clock ? <QuestionClockBar clock={clock} className="text-[1.25em]" /> : null}
        <div className="flex flex-1 flex-col justify-center py-[1em]">
          <Markdown className="qd-prompt text-[1.5em] font-semibold text-balance">
            {q.prompt}
          </Markdown>
        </div>
        <AnswerRules question={q} />
        {q.type === 'image_choice' ? (
          <ImageChoiceGrid options={q.options ?? []} disabled />
        ) : q.options?.length ? (
          <OptionTiles options={q.options} disabled />
        ) : (
          <Input disabled placeholder={t('player.answerPlaceholder')} className="text-center" />
        )}
      </div>
    );
  } else if ((view.state === 'REVEAL' || view.state === 'LEADERBOARD') && q && view.reveal) {
    body = (
      <div className="flex min-h-[32em] w-full flex-col items-center gap-[1em] p-[1em] text-center">
        <RevealAnswer question={q} reveal={view.reveal} />
        <AnswerExplanation reveal={view.reveal} />
        <p className="text-muted-foreground text-[0.9em]">{t('preview.personalHidden')}</p>
      </div>
    );
  } else if (view.state === 'PODIUM' && view.podium) {
    body = (
      <div className="flex min-h-[32em] w-full flex-col items-center gap-[1em] p-[1em]">
        <h2 className="text-[1.5em] font-bold">{t('player.podium')}</h2>
        {/* The room's podium, at a phone's width. */}
        <div className="w-full text-[0.55em]">
          <Podium rows={view.podium.podium} />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="text-muted-foreground flex min-h-[32em] w-full items-center justify-center p-[1em] text-center">
        {view.state === 'ENDED' ? t('screen.thanks') : t('player.waitingHost')}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      {note ? <p className="text-muted-foreground text-sm">{t('preview.note')}</p> : null}
      {/* A phone-sized frame with the participant's typographic base; light, as the phone
          is, in a dark page too. */}
      <div
        className={cn(
          'light bg-background text-foreground w-full max-w-[24em] overflow-hidden rounded-[1.5rem] border-[6px] border-neutral-800 shadow-xl',
          TYPE_BASE.phone,
        )}
      >
        <LiveTheme theme={view.theme}>
          <Surface
            // A slide brings its own background; the last question's must not show behind it.
            background={view.state === 'SLIDE_SHOW' ? null : (q?.background ?? themed?.background)}
            textTone={q?.background ? q.textTone : themed?.textTone}
            textOutline={q?.background ? q.textOutline : !!themed && 'url' in themed.background}
            className={cn('flex w-full', !q?.background && !themed && 'bg-transparent')}
          >
            {/* A live room's variables; a quiz's preview has no room, they stay as written. */}
            {pin ? (
              <RoomVariables view={view} pin={pin}>
                {body}
              </RoomVariables>
            ) : (
              body
            )}
          </Surface>
        </LiveTheme>
      </div>
    </div>
  );
}
