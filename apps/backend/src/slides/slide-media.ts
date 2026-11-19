import type { MediaKind } from '@prisma/client';
import { assertAssets } from '../media/assert-assets';
import type { PrismaService } from '../prisma/prisma.service';
import type { SlideContent } from './dto/slide-content.schema';

/** The media ids a slide points at: its background, its video and sound, its image blocks. */
export function slideMediaIds(slide: {
  blocks: unknown;
  mediaId: string | null;
  imageMediaId?: string | null;
  videoMediaId?: string | null;
  audioMediaId?: string | null;
}): string[] {
  const ids: string[] = [];
  const walk = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const b of blocks as { type?: string; mediaId?: unknown; columns?: unknown[] }[]) {
      if (b?.type === 'columns') b.columns?.forEach(walk);
      else if (b?.type === 'image' && typeof b.mediaId === 'string') ids.push(b.mediaId);
    }
  };
  walk(slide.blocks);
  for (const id of [slide.mediaId, slide.imageMediaId, slide.videoMediaId, slide.audioMediaId])
    if (id) ids.push(id);
  return ids;
}

/**
 * Checks the media a slide is saved with (#125): each asset exists, belongs to
 * the author and is of the kind its place holds — an image behind the slide or
 * in a block, a video, a sound. The one-sound rule is the content schema's.
 * `attached` are the assets the slide already holds (a quiz handed over keeps them).
 */
export async function checkSlideMedia(
  prisma: PrismaService,
  ownerId: string,
  dto: SlideContent,
  attached: string[] = [],
): Promise<void> {
  const expected = new Map<string, MediaKind>();
  for (const id of slideMediaIds({ blocks: dto.blocks, mediaId: null })) expected.set(id, 'image');
  if (dto.mediaId) expected.set(dto.mediaId, 'image');
  if (dto.imageMediaId) expected.set(dto.imageMediaId, 'image');
  if (dto.videoMediaId) expected.set(dto.videoMediaId, 'video');
  if (dto.audioMediaId) expected.set(dto.audioMediaId, 'audio');
  // Only what changes is checked: an image block the slide already had is not asked again.
  const fresh = [...expected].filter(([id, kind]) => !attached.includes(id) || kind !== 'image');
  await assertAssets(prisma, ownerId, new Map(fresh), attached);
}
