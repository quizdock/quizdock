import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertAssets, expectImage } from '../media/assert-assets';
import { type MediaKind, Prisma, QuizStatus } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  acceptedAnswersData,
  optionsData,
  questionCreateData,
  questionData,
  questionMediaHeld,
} from './question-data';
import { type QuestionContent, questionIssues } from './dto/question-content.schema';
import type { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import {
  QUESTION_MEDIA_INCLUDE,
  assertOptionImages,
  questionMediaOf,
  resolveQuestionMedia,
} from './question-media';
import { requireQuiz } from '../quizzes/quiz-access';

export const QUESTION_INCLUDE = {
  options: { orderBy: { orderIndex: 'asc' } },
  acceptedAnswers: true,
  ...QUESTION_MEDIA_INCLUDE,
} satisfies Prisma.QuestionInclude;

type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof QUESTION_INCLUDE }>;

/** A question as the editor reads it: its media as the contract's two slots. */
export function toQuestionOutput(q: QuestionRow) {
  const { visualMedia, audioMedia, ...rest } = q;
  return { ...rest, media: questionMediaOf({ visualMedia, audioMedia }) };
}

/** Décalage temporaire pour réordonner sans violer @@unique([quizId, orderIndex]). */
const REORDER_OFFSET = 1000;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async add(ownerId: string, quizId: string, dto: QuestionContent) {
    try {
      return await this.addOnce(ownerId, quizId, dto);
    } catch (err) {
      // Another question took the last place at the same time (a double click, two
      // tabs): the next place is free now. A second clash is reported as a conflict.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      return this.addOnce(ownerId, quizId, dto);
    }
  }

  private async addOnce(ownerId: string, quizId: string, dto: QuestionContent) {
    await requireQuiz(this.prisma, quizId, ownerId);
    await this.assertPlayableIfReady(quizId, dto);
    const agg = await this.prisma.question.aggregate({
      where: { quizId },
      _max: { orderIndex: true },
    });
    const orderIndex = (agg._max.orderIndex ?? -1) + 1;
    const media = await resolveQuestionMedia(this.prisma, ownerId, dto.media);
    await assertOptionImages(
      this.prisma,
      ownerId,
      dto.options.map((o) => o.mediaId),
    );
    await assertAssets(this.prisma, ownerId, expectImage(dto.backgroundMediaId));
    // Its hint's media, the author's and of their kind (SPECIFICATIONS-HINTS).
    await assertAssets(this.prisma, ownerId, hintAssets(dto.hint));
    const [{ id }] = await this.prisma.$transaction([
      this.prisma.question.create({
        data: { quizId, ...questionCreateData(dto, orderIndex, media) },
        // Its relations are read after: inside the transaction, Prisma would fetch them
        // at once on the one connection it holds, which pg deprecates.
        select: { id: true },
      }),
      this.prisma.quiz.update({
        where: { id: quizId },
        data: { questionCount: { increment: 1 } },
      }),
    ]);
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id },
      include: QUESTION_INCLUDE,
    });
    return toQuestionOutput(question);
  }

  async update(ownerId: string, questionId: string, dto: QuestionContent) {
    const current = await this.assertQuestionOwned(ownerId, questionId);
    await this.assertPlayableIfReady(current.quizId, dto);
    // Remplacement complet des enfants (atomique). OK tant que le quiz n'a pas
    // été joué (les sessions jouées sont figées par snapshot, §2.7).
    const media = await resolveQuestionMedia(this.prisma, ownerId, dto.media, [
      current.visualMediaId,
      current.audioMediaId,
    ]);
    await assertOptionImages(
      this.prisma,
      ownerId,
      dto.options.map((o) => o.mediaId),
      current.options.map((o) => o.mediaId),
    );
    await assertAssets(this.prisma, ownerId, expectImage(dto.backgroundMediaId), [
      current.backgroundMediaId,
    ]);
    await assertAssets(this.prisma, ownerId, hintAssets(dto.hint), [
      ...hintAssets(current.hint as QuestionContent['hint']).keys(),
    ]);
    const data = questionData(dto);
    const options = optionsData(dto);
    const question = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...data,
        ...media,
        options: { deleteMany: {}, create: options },
        acceptedAnswers: { deleteMany: {}, create: acceptedAnswersData(dto) },
      },
      include: QUESTION_INCLUDE,
    });
    // A replaced or removed media leaves with its file, unless something else holds it.
    await this.media.releaseUnused(
      questionMediaHeld(current),
      questionMediaHeld({ ...data, ...media, options }),
    );
    return toQuestionOutput(question);
  }

  /**
   * A ready quiz can be started at any time: a question saved in it must be complete.
   * A draft saves anything that holds together (UI system §1.5).
   */
  private async assertPlayableIfReady(quizId: string, dto: QuestionContent) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { status: true },
    });
    if (quiz?.status === QuizStatus.ready && questionIssues(dto).length > 0) {
      throw new BadRequestException('question.incomplete_in_ready_quiz');
    }
  }

  async remove(ownerId: string, questionId: string): Promise<void> {
    const question = await this.assertQuestionOwned(ownerId, questionId);
    await this.prisma.$transaction([
      this.prisma.question.delete({ where: { id: questionId } }),
      this.prisma.quiz.update({
        where: { id: question.quizId },
        data: { questionCount: { decrement: 1 } },
      }),
    ]);
    await this.media.releaseUnused(questionMediaHeld(question));
  }

  async reorder(ownerId: string, quizId: string, dto: ReorderQuestionsDto) {
    await requireQuiz(this.prisma, quizId, ownerId);
    const owned = await this.prisma.question.findMany({
      where: { quizId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((q) => q.id));
    const { items } = dto;
    if (items.length !== ownedIds.size) {
      throw new BadRequestException('question.reorder_incomplete');
    }
    const indices = new Set<number>();
    for (const it of items) {
      if (!ownedIds.has(it.questionId)) {
        throw new BadRequestException('question.not_in_quiz');
      }
      indices.add(it.orderIndex);
    }
    const isPermutation =
      indices.size === items.length && [...indices].every((i) => i >= 0 && i < items.length);
    if (!isPermutation) {
      throw new BadRequestException('question.invalid_permutation');
    }
    // Deux phases : on décale d'abord (valeurs uniques hors plage finale) puis on
    // pose les positions finales — évite toute collision d'unicité immédiate.
    await this.prisma.$transaction([
      ...items.map((it) =>
        this.prisma.question.update({
          where: { id: it.questionId },
          data: { orderIndex: it.orderIndex + REORDER_OFFSET },
        }),
      ),
      ...items.map((it) =>
        this.prisma.question.update({
          where: { id: it.questionId },
          data: { orderIndex: it.orderIndex },
        }),
      ),
    ]);
    const questions = await this.prisma.question.findMany({
      where: { quizId },
      orderBy: { orderIndex: 'asc' },
      include: QUESTION_INCLUDE,
    });
    return questions.map(toQuestionOutput);
  }

  /** Isolation des routes /questions/:qid : on remonte au propriétaire via le quiz. */
  private async assertQuestionOwned(ownerId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, quiz: { ownerId } },
      select: {
        id: true,
        quizId: true,
        visualMediaId: true,
        audioMediaId: true,
        backgroundMediaId: true,
        hint: true,
        options: { select: { mediaId: true } },
      },
    });
    if (!question) {
      throw new NotFoundException('question.not_found');
    }
    return question;
  }
}

/** The media a hint holds, each with the kind its place takes. */
function hintAssets(hint: QuestionContent['hint'] | null | undefined): Map<string, MediaKind> {
  const assets = new Map<string, MediaKind>();
  if (hint?.imageMediaId) assets.set(hint.imageMediaId, 'image');
  if (hint?.videoMediaId) assets.set(hint.videoMediaId, 'video');
  if (hint?.audioMediaId) assets.set(hint.audioMediaId, 'audio');
  return assets;
}
