import {
  type QuestionMedia,
  TIME_LIMIT_S,
  type QuestionContent,
  normalizeAnswer,
} from '@quiz-dock/contracts';
import type { QuizDetailDtoQuestionsItem } from '../api/generated/model';
import { StepLivePreview } from './step-live-preview';
import { stepView } from './step-view';
import { type FormValues, buildPayload } from './question-form-model';

/**
 * The question as the room will see it, while it is being written: the step preview
 * (StepLivePreview), its right answer shown on request.
 */
export function LivePreview({
  values,
  position = { index: 0, total: 1 },
}: {
  values: FormValues;
  position?: { index: number; total: number };
}) {
  return (
    <StepLivePreview
      canReveal
      deps={[values, position.index, position.total]}
      viewOf={({ reveal, url, theme }) => {
        const question = previewQuestion(values);
        const view = stepView([{ kind: 'question', id: question.id, question }], 0, NO_QUIZ, url, {
          reveal,
          theme,
        });
        // Where it stands in the quiz, as the room's band will say.
        return {
          ...view,
          questionIndex: position.index,
          totalQuestions: position.total,
          question: view.question && { ...view.question, questionIndex: position.index },
        };
      }}
    />
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
    mediaStyle: p.mediaStyle ?? null,
    hint: p.hint ?? null,
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
