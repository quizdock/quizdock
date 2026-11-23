import { describe, expect, it } from 'vitest';
import type { QuizDetailDtoQuestionsItem, QuizDetailDtoSlidesItem } from '../api/generated/model';
import { moveItem, quizItems, slideLabel } from './quiz-items';

const q = (id: string, orderIndex: number) =>
  ({ id, orderIndex }) as unknown as QuizDetailDtoQuestionsItem;
const s = (id: string, beforeQuestionId: string | null, orderIndex: number) =>
  ({ id, beforeQuestionId, orderIndex }) as unknown as QuizDetailDtoSlidesItem;

describe('quizItems', () => {
  it('interleaves slides before their anchor question, end slides last, sorted by orderIndex', () => {
    const items = quizItems({
      questions: [q('qb', 1), q('qa', 0)],
      slides: [
        s('end-1', null, 1),
        s('before-b', 'qb', 0),
        s('end-0', null, 0),
        s('before-a', 'qa', 0),
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['before-a', 'qa', 'before-b', 'qb', 'end-0', 'end-1']);
  });

  it('treats a slide anchored on a missing question as an end slide', () => {
    const items = quizItems({ questions: [q('qa', 0)], slides: [s('orphan', 'gone', 0)] });
    expect(items.map((i) => i.id)).toEqual(['qa', 'orphan']);
  });
});

describe('moveItem', () => {
  const items = quizItems({ questions: [q('qa', 0), q('qb', 1)], slides: [s('s1', 'qb', 0)] });

  it('swaps with the neighbour in the given direction', () => {
    expect(moveItem(items, 1, -1).map((i) => i.id)).toEqual(['s1', 'qa', 'qb']);
    expect(moveItem(items, 1, 1).map((i) => i.id)).toEqual(['qa', 'qb', 's1']);
  });

  it('is a no-op at the edges', () => {
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 2, 1)).toBe(items);
  });
});

describe('slideLabel', () => {
  const quiz = { title: 'Discover France', questionCount: 12 };
  const slide = (blocks: unknown[]) => ({ blocks }) as unknown as QuizDetailDtoSlidesItem;

  it("reads the quiz's variables, leaving the room's as written", () => {
    expect(slideLabel(slide([{ type: 'heading', id: 'a', text: '{title}' }]), quiz)).toBe(
      'Discover France',
    );
    expect(slideLabel(slide([{ type: 'text', id: 'a', md: '{questions} at {pin}' }]), quiz)).toBe(
      '12 at {pin}',
    );
  });
});
