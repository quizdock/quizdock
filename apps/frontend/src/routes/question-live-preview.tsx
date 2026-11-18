import {
  type QuestionMedia,
  TIME_LIMIT_S,
  type QuestionContent,
  normalizeAnswer,
} from '@quiz-dock/contracts';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Pin, PinOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { cn } from '@/lib/utils';
import { useSessionState } from '@/lib/use-session-state';
import type { QuizDetailDtoQuestionsItem } from '../api/generated/model';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useMediaUrl } from '@/lib/media-url';
import { RoomScreen } from './quiz-steps-preview';
import { stepView } from './step-view';
import { useQuizTheme } from '@/lib/quiz-theme';
import { type FormValues, buildPayload } from './question-form-model';

/**
 * The question as the room will see it, while it is being written: the real
 * projection or phone (UI system §3), folded until asked for.
 */
export function LivePreview({
  values,
  position = { index: 0, total: 1 },
}: {
  values: FormValues;
  position?: { index: number; total: number };
}) {
  const { t } = useTranslation('editor');
  const url = useMediaUrl();
  const [device, setDevice] = useState<'projection' | 'phone'>('projection');
  const [answer, setAnswer] = useState(false);
  // Pinned, it stays at the top while the form scrolls, from one question to the next.
  const [pinned, setPinned] = useSessionState(
    'editor:preview-pinned',
    false,
    (v): v is boolean => typeof v === 'boolean',
  );
  // In the quiz's theme, as the room will see it.
  const theme = useQuizTheme();
  const view = useMemo(() => {
    const question = previewQuestion(values);
    const view = stepView([{ kind: 'question', id: question.id, question }], 0, NO_QUIZ, url, {
      reveal: answer,
      theme,
    });
    // Where it stands in the quiz, as the room's band will say.
    return {
      ...view,
      questionIndex: position.index,
      totalQuestions: position.total,
      question: view.question && {
        ...view.question,
        questionIndex: position.index,
      },
    };
  }, [values, url, answer, position.index, position.total, theme]);
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
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={answer}
              onCheckedChange={setAnswer}
              aria-label={t('preview.showAnswer')}
            />
            {t('preview.showAnswer')}
          </label>
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

/** A preview has no quiz around it: no title, no variables. */
const NO_QUIZ = {
  title: '',
  description: null,
  questionCount: 1,
  tags: [],
  license: null,
};

/** The question being written, in the shape of a saved one, for the preview. */
function previewQuestion(v: FormValues): QuizDetailDtoQuestionsItem {
  const p = buildPayload(v) as Partial<QuestionContent> & {
    media: QuestionMedia;
  };
  return {
    id: 'preview',
    quizId: '',
    orderIndex: 0,
    type: v.type,
    prompt: v.prompt,
    media: p.media,
    answerExplanation: p.answerExplanation ?? null,
    backgroundMediaId: v.background.mediaId,
    backgroundGradient: v.background.gradient,
    backgroundStyle: v.background.style,
    textTone: v.background.textTone,
    textOutline: v.background.textOutline,
    timeLimitS: p.timeLimitS ?? TIME_LIMIT_S.default,
    revealDelayS: p.revealDelayS ?? null,
    audioTarget: p.audioTarget ?? null,
    waveformSize: v.waveformSize,
    mediaPosition: v.mediaPosition,
    timerAfterMedia: p.timerAfterMedia ?? false,
    pointsMode: p.pointsMode ?? 'standard',
    scoring: p.scoring ?? 'standard',
    numericValue: v.numericValue == null ? null : String(v.numericValue),
    numericTolerance: v.numericTolerance == null ? null : String(v.numericTolerance),
    multiSelect: v.type === 'image_choice' && v.multiSelect,
    options: (p.options ?? []).map((o, i) => ({
      id: v.options[i]?.key ?? String(i),
      orderIndex: i,
      text: o.text ?? null,
      mediaId: o.mediaId ?? null,
      alt: o.alt ?? null,
      color: o.color,
      shape: o.shape,
      isCorrect: o.isCorrect ?? false,
      correctOrderIndex: o.correctOrderIndex ?? null,
    })),
    acceptedAnswers: (p.acceptedAnswers ?? []).map((a, i) => ({
      id: String(i),
      text: a.text,
      normalized: normalizeAnswer(a.text),
    })),
  } as QuizDetailDtoQuestionsItem;
}
