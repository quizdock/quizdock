import {
  type MediaPosition,
  type MediaStyle,
  type SlideBlock,
  type SlideShowPayload,
  type PublicOption,
  fillSlideBlocks,
  quizVariables,
} from '@quiz-dock/contracts';
import { AudioLines } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/markdown';
import { COLOR_BG, OPTION_BG_FALLBACK } from '@/lib/option-style';
import { cn } from '@/lib/utils';
import type {
  QuizDetailDto,
  QuizDetailDtoQuestionsItem,
  QuizDetailDtoSlidesItem,
} from '../api/generated/model';
import type { QuizItem } from '@/lib/quiz-items';
import { ScaledStage, SlideStage } from '../game/slide-stage';
import { ShapeIcon } from '@/components/shape-icon';
import { ImageChoiceGrid } from '../game/image-choice';
import { type MediaResolver, mediaUrl, useMediaUrl } from '@/lib/media-url';
import { stepBackground } from '@/lib/step-background';
import { QuizThemeProvider, useQuizTheme, useQuizThemeValues } from '@/lib/quiz-theme';
import { LiveTheme, themeBackdrop } from '../game/theme';
import { Surface } from '../game/surface';
import { VariablesContext } from '@/lib/variables';

/**
 * A quiz's steps as they will show, still: what the preview walks through and
 * the read-only view lays out, each on the 1280×720 stage.
 */

/** What a step's preview reads of its quiz: the fields its slides' variables show. */
export type StepQuiz = Pick<
  QuizDetailDto,
  'title' | 'description' | 'questionCount' | 'ownerName' | 'tags' | 'license'
>;

/** The quiz's fields its slides' variables read (`{title}`, `{questions}`…). */
export function slideQuizFieldsOf(quiz: StepQuiz) {
  return {
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questionCount,
    ...(quiz.ownerName ? { author: quiz.ownerName } : {}),
    tags: quiz.tags,
    license: quiz.license,
  };
}

/** Gives what's inside the quiz's variables (`{title}`…); the room's stay as written. */
export function QuizVariables({ quiz, children }: { quiz: StepQuiz; children: ReactNode }) {
  return (
    <VariablesContext.Provider value={quizVariables(slideQuizFieldsOf(quiz))}>
      {children}
    </VariablesContext.Provider>
  );
}

/** A slide, stored or being edited, as the screens would get it, the quiz's variables filled. */
export function slideShowOf(
  slide: Pick<
    QuizDetailDtoSlidesItem,
    | 'blocks'
    | 'mediaId'
    | 'gradient'
    | 'backgroundStyle'
    | 'imageMediaId'
    | 'videoMediaId'
    | 'mediaPosition'
    | 'mediaStyle'
    | 'videoLoop'
    | 'videoSound'
    | 'textTone'
    | 'textOutline'
    | 'displayDelayS'
  >,
  index: number,
  quizFields?: Parameters<typeof quizVariables>[0],
  url: MediaResolver = mediaUrl,
): SlideShowPayload {
  const blocks = withImageUrls(slide.blocks as SlideBlock[], url);
  return {
    slideIndex: index,
    questionIndex: 0,
    blocks: quizFields ? fillSlideBlocks(blocks, quizVariables(quizFields)) : blocks,
    background: stepBackground(slide.mediaId, slide.gradient, slide.backgroundStyle, url),
    // Its video, shown still (its first frame) behind the content.
    video: slide.videoMediaId
      ? {
          url: url(slide.videoMediaId),
          loop: slide.videoLoop,
          sound: slide.videoSound,
          gainDb: 0,
        }
      : null,
    // Its picture, where it or the video sits, and how it is framed (SPECIFICATIONS-STEP-EDITOR).
    ...(slide.imageMediaId && !slide.videoMediaId
      ? { image: { url: url(slide.imageMediaId), alt: null } }
      : {}),
    ...((slide.imageMediaId || slide.videoMediaId) &&
    slide.mediaPosition &&
    slide.mediaPosition !== 'behind'
      ? { position: slide.mediaPosition as MediaPosition }
      : {}),
    ...(slide.mediaStyle ? { style: slide.mediaStyle as MediaStyle } : {}),
    textTone: slide.textTone,
    textOutline: slide.textOutline,
    displayDelayS: slide.displayDelayS,
  };
}

/** Image blocks with the address of their picture, wherever it is served. */
function withImageUrls(blocks: SlideBlock[], url: MediaResolver): SlideBlock[] {
  return blocks.map((b) =>
    b.type === 'columns'
      ? { ...b, columns: b.columns.map((column) => withImageUrls(column, url) as typeof column) }
      : b.type === 'image' && b.mediaId && !b.url
        ? { ...b, url: url(b.mediaId) }
        : b,
  );
}

/** A question on the 1280×720 stage, on its own background as the projection shows it. */
export function QuestionPreview({ question }: { question: QuizDetailDtoQuestionsItem }) {
  const url = useMediaUrl();
  const background = stepBackground(
    question.backgroundMediaId,
    question.backgroundGradient,
    question.backgroundStyle,
    url,
  );
  // Without a background of its own, the quiz theme's.
  const theme = useQuizTheme();
  const themed = background ? null : themeBackdrop(theme);
  return (
    <LiveTheme theme={theme}>
      <Surface
        background={background ?? themed?.background}
        textTone={themed?.textTone ?? question.textTone}
        textOutline={themed ? 'url' in themed.background : question.textOutline}
        className="h-full w-full"
      >
        {question.type === 'image_choice' ? (
          <ImageChoicePreview question={question} />
        ) : (
          <QuestionBody question={question} />
        )}
      </Surface>
    </LiveTheme>
  );
}

function QuestionBody({ question }: { question: QuizDetailDtoQuestionsItem }) {
  const { t } = useTranslation('editor');
  const url = useMediaUrl();
  const markWrong = question.type !== 'ordering' && question.options.some((o) => o.isCorrect);
  return (
    // Centred, as the projection shows a question.
    <article className="flex h-full w-full flex-col items-center justify-center gap-5 p-12 text-center">
      <div className="text-sm uppercase tracking-wide text-muted-foreground">
        {t(`questionType.${question.type}`, { defaultValue: question.type })}
      </div>
      {question.media?.visual?.kind === 'image' && (
        <img
          className="max-h-[260px] self-center object-contain"
          src={url(question.media.visual.assetId)}
          alt=""
        />
      )}
      {question.media?.visual?.kind === 'video' && 'assetId' in question.media.visual ? (
        // Its first frame, still: the preview plays nothing.
        <video
          className="max-h-[260px] self-center rounded-lg object-contain"
          src={`${url(question.media.visual.assetId)}#t=0.1`}
          preload="metadata"
          muted
          aria-label={t('preview.video')}
        />
      ) : null}
      {question.media?.audio ? (
        <div className="text-muted-foreground flex items-center gap-2 self-center text-xl">
          <AudioLines className="size-6" aria-hidden />
          {t('preview.sound', { seconds: Math.round(question.media?.audio.durationMs / 1000) })}
        </div>
      ) : null}
      <Markdown role="heading" aria-level={2} className="text-4xl font-semibold">
        {question.prompt}
      </Markdown>
      <div className="text-muted-foreground text-xl">⏱ {question.timeLimitS} s</div>

      {question.options.length > 0 && (
        <ul className="grid w-full grid-cols-2 gap-4 text-left">
          {question.options.map((opt) => (
            <li
              key={opt.id}
              className={cn(
                'flex items-center gap-3 rounded-lg font-semibold text-white',
                'px-6 py-4 text-2xl',
                COLOR_BG[opt.color] ?? OPTION_BG_FALLBACK,
                opt.isCorrect && 'outline outline-2 outline-offset-2 outline-success',
                // The wrong ones greyed, when the question has right ones (not a poll, not an order).
                markWrong && !opt.isCorrect && 'opacity-40 grayscale',
              )}
            >
              <span className="text-3xl" aria-hidden="true">
                <ShapeIcon shape={opt.shape} />
              </span>
              <span className="flex-1">
                {opt.text ?? t('preview.optionFallback', { index: opt.orderIndex + 1 })}
              </span>
              {question.type === 'ordering' && opt.correctOrderIndex != null && (
                <span className="rounded-full bg-black/25 px-2">#{opt.correctOrderIndex + 1}</span>
              )}
              {opt.isCorrect && <span aria-label={t('preview.correctAnswer')}>✓</span>}
            </li>
          ))}
        </ul>
      )}

      {question.acceptedAnswers.length > 0 && (
        <div className="text-lg text-muted-foreground">
          {t('preview.acceptedAnswers', {
            answers: question.acceptedAnswers.map((a) => a.text).join(', '),
          })}
        </div>
      )}

      {question.type === 'numeric' && question.numericValue != null && (
        <div className="text-lg text-muted-foreground">
          {t('preview.numericTarget', {
            value: question.numericValue,
            tolerance: question.numericTolerance ?? 0,
          })}
        </div>
      )}
    </article>
  );
}

/**
 * An image choice as the projection lays it out: the prompt on one line, the
 * pictures filling the rest, the right one(s) forward and the others dimmed.
 */
function ImageChoicePreview({ question }: { question: QuizDetailDtoQuestionsItem }) {
  const { t } = useTranslation('editor');
  const url = useMediaUrl();
  const options = question.options.map((o) => ({
    id: o.id,
    text: null,
    color: o.color as PublicOption['color'],
    shape: o.shape as PublicOption['shape'],
    media: o.mediaId ? { url: url(o.mediaId), kind: 'image' as const, alt: o.alt ?? null } : null,
  }));
  return (
    <article className="flex h-full w-full flex-col gap-4 p-10 text-left">
      <div className="flex shrink-0 items-center gap-6">
        <Markdown
          role="heading"
          aria-level={2}
          className="line-clamp-2 flex-1 text-3xl font-semibold"
        >
          {question.prompt}
        </Markdown>
        <div className="text-muted-foreground shrink-0 text-xl">⏱ {question.timeLimitS} s</div>
      </div>
      <div className="text-muted-foreground shrink-0 text-sm tracking-wide uppercase">
        {t(`questionType.${question.type}`)}
        {question.media?.audio
          ? ` · ${t('preview.sound', { seconds: Math.round(question.media.audio.durationMs / 1000) })}`
          : ''}
      </div>
      <ImageChoiceGrid
        fit="screen"
        className="flex-1 text-2xl"
        options={options}
        correctIds={question.options.filter((o) => o.isCorrect).map((o) => o.id)}
      />
    </article>
  );
}

/**
 * One step of a quiz as it will show, still, on the projection's 16:9 stage — a
 * slide (its background, video and variables filled) or a question (its media,
 * answers, the right ones marked). The one preview every page shows.
 */
export function StepStage({
  item,
  index,
  quiz,
  className,
}: {
  item: QuizItem;
  /** Its place in the sequence. */
  index: number;
  quiz: StepQuiz;
  className?: string;
}) {
  const url = useMediaUrl();
  // In the quiz's theme: the editor's, else the quiz's own (a card, a read-only page).
  const own = useQuizThemeValues(quiz as { themeId?: string | null; themeBuiltin?: string | null });
  const theme = useQuizTheme() ?? own;
  return (
    <QuizThemeProvider value={theme}>
      {item.kind === 'slide' ? (
        <LiveTheme theme={theme}>
          <SlideStage
            className={cn('rounded-xl border', className)}
            slide={slideShowOf(item.slide, index, slideQuizFieldsOf(quiz), url)}
          />
        </LiveTheme>
      ) : (
        <ScaledStage className={cn('rounded-xl border', className)}>
          <QuestionPreview question={item.question} />
        </ScaledStage>
      )}
    </QuizThemeProvider>
  );
}
