import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { MediaService } from '../media/media.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SlidesService } from './slides.service';

const OWNER = 'owner-1';
const id = (n: string) => n.padEnd(26, '0');

function makePrisma() {
  return {
    // The quiz's status: a draft unless a test says otherwise.
    quiz: { findFirst: jest.fn(), findUnique: jest.fn(async () => ({ status: 'draft' })) },
    mediaAsset: { findMany: jest.fn() },
    question: { findMany: jest.fn(), update: jest.fn((args: unknown) => args) },
    slide: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn((args: unknown) => args),
      update: jest.fn((args: unknown) => args),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

describe('SlidesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: SlidesService;
  const media = { releaseUnused: jest.fn(async () => undefined) };

  beforeEach(() => {
    prisma = makePrisma();
    media.releaseUnused.mockClear();
    service = new SlidesService(
      prisma as unknown as PrismaService,
      media as unknown as MediaService,
    );
    prisma.quiz.findFirst.mockResolvedValue({ id: 'quiz-1' });
  });

  describe('add', () => {
    it('appends after the last end-anchored slide, with the blocks and no background', async () => {
      prisma.slide.aggregate.mockResolvedValue({ _max: { orderIndex: 1 } });
      await service.add(OWNER, 'quiz-1', {
        blocks: [{ type: 'heading', id: 'h', text: 'Intro', level: 1 }],
        textTone: 'light',
        textOutline: false,
        videoLoop: true,
        videoSound: true,
        waveformSize: 'hidden',
        mediaPosition: 'behind',
      });
      const data = (prisma.slide.create.mock.calls[0][0] as { data: unknown }).data;
      expect(data).toMatchObject({
        quizId: 'quiz-1',
        beforeQuestionId: null,
        orderIndex: 2,
        blocks: [{ type: 'heading', id: 'h', text: 'Intro', level: 1 }],
        mediaId: null,
        displayDelayS: null,
      });
    });

    it('an empty slide waits in a draft, never in a published quiz (UI system §1.5)', async () => {
      prisma.slide.aggregate.mockResolvedValue({ _max: { orderIndex: null } });
      const empty = {
        blocks: [],
        textTone: 'light' as const,
        textOutline: true,
        videoLoop: true,
        videoSound: true,
        waveformSize: 'hidden' as const,
        mediaPosition: 'behind' as const,
      };
      await service.add(OWNER, 'quiz-1', empty);
      expect(prisma.slide.create).toHaveBeenCalled();
      prisma.slide.create.mockClear();
      prisma.quiz.findUnique.mockResolvedValueOnce({ status: 'ready' });
      await expect(service.add(OWNER, 'quiz-1', empty)).rejects.toMatchObject({
        response: { message: 'slide.incomplete_in_ready_quiz' },
      });
      expect(prisma.slide.create).not.toHaveBeenCalled();
    });

    it('404 when the quiz is not owned', async () => {
      prisma.quiz.findFirst.mockResolvedValue(null);
      await expect(
        service.add(OWNER, 'quiz-x', {
          blocks: [{ type: 'heading', id: 'h', text: 'x', level: 1 }],
          textTone: 'light',
          textOutline: false,
          videoLoop: true,
          videoSound: true,
          waveformSize: 'hidden',
          mediaPosition: 'behind',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('media on slides (#125)', () => {
    const VID = id('vid');
    const SND = id('snd');
    const content = (over: Record<string, unknown> = {}) =>
      ({
        blocks: [{ type: 'heading', id: 'h', text: 'Listen', level: 1 }],
        textTone: 'light',
        textOutline: true,
        videoLoop: true,
        videoSound: true,
        waveformSize: 'hidden',
        mediaPosition: 'behind',
        ...over,
      }) as Parameters<SlidesService['add']>[2];

    beforeEach(() => {
      prisma.slide.aggregate.mockResolvedValue({ _max: { orderIndex: null } });
      prisma.mediaAsset.findMany.mockResolvedValue([
        { id: VID, kind: 'video' },
        { id: SND, kind: 'audio' },
      ]);
    });

    it("keeps the video, its switches, the sound and the slide's target", async () => {
      await service.add(
        OWNER,
        'quiz-1',
        content({
          videoMediaId: VID,
          videoLoop: false,
          videoSound: false,
          audioMediaId: SND,
          waveformSize: 'L',
          audioTarget: 'everyone',
        }),
      );
      const data = (prisma.slide.create.mock.calls[0][0] as { data: unknown }).data;
      expect(data).toMatchObject({
        videoMediaId: VID,
        videoLoop: false,
        videoSound: false,
        audioMediaId: SND,
        waveformSize: 'L',
        audioTarget: 'everyone',
      });
    });

    it("refuses a media of the wrong kind, or one that is not the author's", async () => {
      await expect(service.add(OWNER, 'quiz-1', content({ videoMediaId: SND }))).rejects.toThrow(
        'media.wrong_kind',
      );
      prisma.mediaAsset.findMany.mockResolvedValue([]);
      await expect(service.add(OWNER, 'quiz-1', content({ audioMediaId: SND }))).rejects.toThrow(
        'media.not_found',
      );
    });
  });

  describe('media left behind (audit B9)', () => {
    const IMG = id('img');
    const BG = id('bg');
    const VID = id('vid');
    const SND = id('snd');
    const held = {
      id: 's1',
      quizId: 'quiz-1',
      blocks: [
        { type: 'image', id: 'i', mediaId: IMG },
        { type: 'columns', id: 'c', columns: [[{ type: 'image', id: 'j', mediaId: BG }]] },
      ],
      mediaId: BG,
      videoMediaId: VID,
      audioMediaId: SND,
    };

    /** The media the element held, minus those it still holds. */
    const released = () => {
      const [before, kept = []] = media.releaseUnused.mock.calls[0] as unknown as [
        string[],
        string[]?,
      ];
      return [...new Set(before.filter((m) => !kept.includes(m)))].sort();
    };

    it('releases what a save took off the slide, not what it kept', async () => {
      prisma.slide.findFirst.mockResolvedValue(held);
      prisma.mediaAsset.findMany.mockResolvedValue([]);
      await service.update(OWNER, 's1', {
        blocks: [{ type: 'image', id: 'i', mediaId: IMG }],
        textTone: 'light',
        textOutline: true,
        videoLoop: true,
        videoSound: true,
        waveformSize: 'hidden',
        mediaPosition: 'behind',
      } as Parameters<SlidesService['update']>[2]);
      expect(released()).toEqual([BG, SND, VID].sort());
    });

    it('releases everything a deleted slide held', async () => {
      prisma.slide.findFirst.mockResolvedValue(held);
      await service.remove(OWNER, 's1');
      expect(released()).toEqual([BG, IMG, SND, VID].sort());
    });
  });

  describe('reorderItems', () => {
    beforeEach(() => {
      prisma.question.findMany.mockResolvedValue([{ id: id('q1') }, { id: id('q2') }]);
      prisma.slide.findMany.mockResolvedValue([{ id: id('s1') }, { id: id('s2') }]);
    });

    it('rejects an incomplete sequence', async () => {
      await expect(
        service.reorderItems(OWNER, 'quiz-1', {
          items: [{ kind: 'question', id: id('q1') }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an item from another quiz or a duplicate', async () => {
      await expect(
        service.reorderItems(OWNER, 'quiz-1', {
          items: [
            { kind: 'question', id: id('q1') },
            { kind: 'question', id: id('q1') },
            { kind: 'slide', id: id('s1') },
            { kind: 'slide', id: id('s2') },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('renumbers questions and anchors each slide to the question that follows it', async () => {
      prisma.slide.findMany.mockResolvedValueOnce([{ id: id('s1') }, { id: id('s2') }]);
      prisma.slide.findMany.mockResolvedValueOnce([]);
      // s1, q2, s2, q1  → q2 becomes #0 with s1 before it; q1 becomes #1 with s2 before it.
      await service.reorderItems(OWNER, 'quiz-1', {
        items: [
          { kind: 'slide', id: id('s1') },
          { kind: 'question', id: id('q2') },
          { kind: 'slide', id: id('s2') },
          { kind: 'question', id: id('q1') },
        ],
      });
      const finalQuestionUpdates = prisma.question.update.mock.calls
        .map((c) => c[0] as { where: { id: string }; data: { orderIndex: number } })
        .filter((u) => u.data.orderIndex < 1000);
      expect(finalQuestionUpdates).toEqual([
        { where: { id: id('q2') }, data: { orderIndex: 0 } },
        { where: { id: id('q1') }, data: { orderIndex: 1 } },
      ]);
      expect(prisma.slide.update.mock.calls.map((c) => c[0])).toEqual([
        { where: { id: id('s1') }, data: { beforeQuestionId: id('q2'), orderIndex: 0 } },
        { where: { id: id('s2') }, data: { beforeQuestionId: id('q1'), orderIndex: 0 } },
      ]);
    });

    it('slides after the last question are anchored to the end (null)', async () => {
      prisma.slide.findMany.mockResolvedValueOnce([{ id: id('s1') }, { id: id('s2') }]);
      prisma.slide.findMany.mockResolvedValueOnce([]);
      await service.reorderItems(OWNER, 'quiz-1', {
        items: [
          { kind: 'question', id: id('q1') },
          { kind: 'question', id: id('q2') },
          { kind: 'slide', id: id('s1') },
          { kind: 'slide', id: id('s2') },
        ],
      });
      expect(prisma.slide.update.mock.calls.map((c) => c[0])).toEqual([
        { where: { id: id('s1') }, data: { beforeQuestionId: null, orderIndex: 0 } },
        { where: { id: id('s2') }, data: { beforeQuestionId: null, orderIndex: 1 } },
      ]);
    });
  });
});
