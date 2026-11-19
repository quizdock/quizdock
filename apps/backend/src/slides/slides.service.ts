import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ReorderItemsDto } from './dto/reorder-items.dto';
import { QuizStatus } from '@prisma/client';
import { type SlideContent, slideIssues } from './dto/slide-content.schema';
import { checkSlideMedia, slideMediaIds } from './slide-media';
import { slideData } from './slide-data';
import { requireQuiz } from '../quizzes/quiz-access';

/** Temporary shift so questions can be renumbered without hitting @@unique([quizId, orderIndex]). */
const REORDER_OFFSET = 1000;

/**
 * Slides (#7): content items of the quiz sequence, anchored **before** a question
 * (`beforeQuestionId`) or at the end (`null`). A question's own `orderIndex`
 * stays contiguous and untouched, so scoring, stats and exports never see slides.
 */
@Injectable()
export class SlidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /** Appends a slide at the very end of the quiz (after the last question). */
  async add(ownerId: string, quizId: string, dto: SlideContent) {
    await requireQuiz(this.prisma, quizId, ownerId);
    await this.assertPlayableIfReady(quizId, dto);
    await checkSlideMedia(this.prisma, ownerId, dto);
    const agg = await this.prisma.slide.aggregate({
      where: { quizId, beforeQuestionId: null },
      _max: { orderIndex: true },
    });
    return this.prisma.slide.create({
      data: {
        quizId,
        beforeQuestionId: null,
        orderIndex: (agg._max.orderIndex ?? -1) + 1,
        ...slideData(dto),
      },
    });
  }

  async update(ownerId: string, slideId: string, dto: SlideContent) {
    const slide = await this.assertSlideOwned(ownerId, slideId);
    await this.assertPlayableIfReady(slide.quizId, dto);
    const held = slideMediaIds(slide);
    await checkSlideMedia(this.prisma, ownerId, dto, held);
    const data = slideData(dto);
    const saved = await this.prisma.slide.update({ where: { id: slideId }, data });
    // What the slide no longer shows leaves with its file, unless something else holds it.
    await this.media.releaseUnused(held, slideMediaIds(data));
    return saved;
  }

  /** A ready quiz can be started at any time: a slide saved in it must show something. */
  private async assertPlayableIfReady(quizId: string, dto: SlideContent) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { status: true },
    });
    if (quiz?.status === QuizStatus.ready && slideIssues(dto).length > 0) {
      throw new BadRequestException('slide.incomplete_in_ready_quiz');
    }
  }

  async remove(ownerId: string, slideId: string): Promise<void> {
    const slide = await this.assertSlideOwned(ownerId, slideId);
    await this.prisma.slide.delete({ where: { id: slideId } });
    await this.media.releaseUnused(slideMediaIds(slide));
  }

  /**
   * Rewrites the whole sequence: questions get `orderIndex` 0..n-1 in the order
   * given; each slide is anchored to the first question that follows it (or to
   * the end) with an `orderIndex` among the slides sharing that anchor.
   */
  async reorderItems(ownerId: string, quizId: string, dto: ReorderItemsDto) {
    await requireQuiz(this.prisma, quizId, ownerId);
    const [questions, slides] = await Promise.all([
      this.prisma.question.findMany({ where: { quizId }, select: { id: true } }),
      this.prisma.slide.findMany({ where: { quizId }, select: { id: true } }),
    ]);
    const questionIds = new Set(questions.map((q) => q.id));
    const slideIds = new Set(slides.map((s) => s.id));
    const { items } = dto;
    if (items.length !== questionIds.size + slideIds.size) {
      throw new BadRequestException('quiz.reorder_incomplete');
    }
    const seen = new Set<string>();
    for (const it of items) {
      const known = it.kind === 'question' ? questionIds.has(it.id) : slideIds.has(it.id);
      if (!known || seen.has(it.id)) {
        throw new BadRequestException('quiz.item_not_in_quiz');
      }
      seen.add(it.id);
    }

    // Walk the sequence: pending slides attach to the next question met.
    const questionOrder: string[] = [];
    const slideUpdates: { id: string; beforeQuestionId: string | null; orderIndex: number }[] = [];
    let pending: string[] = [];
    for (const it of items) {
      if (it.kind === 'slide') {
        pending.push(it.id);
        continue;
      }
      pending.forEach((id, orderIndex) =>
        slideUpdates.push({ id, beforeQuestionId: it.id, orderIndex }),
      );
      pending = [];
      questionOrder.push(it.id);
    }
    pending.forEach((id, orderIndex) =>
      slideUpdates.push({ id, beforeQuestionId: null, orderIndex }),
    );

    await this.prisma.$transaction([
      ...questionOrder.map((id, i) =>
        this.prisma.question.update({
          where: { id },
          data: { orderIndex: i + REORDER_OFFSET },
        }),
      ),
      ...questionOrder.map((id, i) =>
        this.prisma.question.update({ where: { id }, data: { orderIndex: i } }),
      ),
      ...slideUpdates.map((s) =>
        this.prisma.slide.update({
          where: { id: s.id },
          data: { beforeQuestionId: s.beforeQuestionId, orderIndex: s.orderIndex },
        }),
      ),
    ]);
    return this.prisma.slide.findMany({ where: { quizId }, orderBy: { orderIndex: 'asc' } });
  }

  private async assertSlideOwned(ownerId: string, slideId: string) {
    const slide = await this.prisma.slide.findFirst({
      where: { id: slideId, quiz: { ownerId } },
      select: {
        id: true,
        quizId: true,
        blocks: true,
        mediaId: true,
        imageMediaId: true,
        videoMediaId: true,
        audioMediaId: true,
      },
    });
    if (!slide) {
      throw new NotFoundException('slide.not_found');
    }
    return slide;
  }
}
