import { type SlideBlock, fillVariables, quizVariables } from '@quiz-dock/contracts';
import type { QuizDetailDtoQuestionsItem, QuizDetailDtoSlidesItem } from '../api/generated/model';

/**
 * A `quiz_item` (#7): what the sequence of a quiz is made of. Questions keep
 * their own contiguous `orderIndex`; slides are anchored before a question
 * (`beforeQuestionId`) or at the end (`null`), so the merged order is derived.
 */
export type QuizItem =
  | { kind: 'question'; id: string; question: QuizDetailDtoQuestionsItem }
  | { kind: 'slide'; id: string; slide: QuizDetailDtoSlidesItem };

/** Merged, ordered sequence: for each question, its leading slides then itself; end slides last. */
export function quizItems(quiz: {
  questions: QuizDetailDtoQuestionsItem[];
  slides: QuizDetailDtoSlidesItem[];
}): QuizItem[] {
  const questionIds = new Set(quiz.questions.map((q) => q.id));
  const byAnchor = new Map<string | null, QuizDetailDtoSlidesItem[]>();
  for (const s of [...quiz.slides].sort((a, b) => a.orderIndex - b.orderIndex)) {
    // A slide whose anchor question is gone behaves as an end slide (same as the server).
    const anchor =
      s.beforeQuestionId && questionIds.has(s.beforeQuestionId) ? s.beforeQuestionId : null;
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), s]);
  }
  const slideItems = (anchor: string | null): QuizItem[] =>
    (byAnchor.get(anchor) ?? []).map((slide) => ({ kind: 'slide', id: slide.id, slide }));
  const items: QuizItem[] = [];
  for (const question of [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex)) {
    items.push(...slideItems(question.id), { kind: 'question', id: question.id, question });
  }
  items.push(...slideItems(null));
  return items;
}

/** The sequence with item `index` moved one step; unchanged when out of range. */
export function moveItem(items: QuizItem[], index: number, direction: -1 | 1): QuizItem[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * What to call a slide in a list: its first heading, else its first text, else nothing,
 * with the quiz's variables filled (`{…}` show as written only in the editor's fields).
 */
export function slideLabel(
  slide: Pick<QuizDetailDtoSlidesItem, 'blocks'>,
  quiz: Parameters<typeof quizVariables>[0],
): string {
  const leaves = (slide.blocks as SlideBlock[]).flatMap((b) =>
    b.type === 'columns' ? b.columns.flat() : [b],
  );
  const label =
    leaves.find((b) => b.type === 'heading')?.text ??
    leaves.find((b) => b.type === 'text')?.md ??
    '';
  return fillVariables(label, quizVariables(quiz));
}
