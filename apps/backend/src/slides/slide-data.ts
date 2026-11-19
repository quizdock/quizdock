import { Prisma } from '@prisma/client';
import type { SlideContent } from './dto/slide-content.schema';

/**
 * A slide's content as columns, one way for every path that writes one: the
 * editor, an import, the samples. A new column is added here.
 */
export function slideData(dto: SlideContent) {
  return {
    blocks: dto.blocks as Prisma.InputJsonValue,
    mediaId: dto.mediaId || null,
    gradient: dto.gradient ?? Prisma.JsonNull,
    backgroundStyle: dto.backgroundStyle ?? Prisma.JsonNull,
    imageMediaId: dto.imageMediaId || null,
    videoMediaId: dto.videoMediaId || null,
    mediaPosition: dto.mediaPosition,
    mediaStyle: dto.mediaStyle ?? Prisma.JsonNull,
    videoLoop: dto.videoLoop,
    videoSound: dto.videoSound,
    audioMediaId: dto.audioMediaId || null,
    waveformSize: dto.waveformSize,
    audioTarget: dto.audioTarget ?? null,
    textTone: dto.textTone,
    textOutline: dto.textOutline,
    displayDelayS: dto.displayDelayS ?? null,
  };
}
